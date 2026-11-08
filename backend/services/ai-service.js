import { requireAuthoredWork } from './works/context.js';
import { createOpenAiProvider, openAiBody } from '../ai/providers/openai.js';
import { estimateCost } from '../ai/pricing.js';
import { monthStart } from './ai-settings-service.js';
import { validateAiCheckInput } from '../dto/ai-check-input.js';
import { randomUUID } from 'node:crypto';
import { UserError } from '../errors.js';
import { createAiRepository } from '../repositories/ai-repository.js';
import { createFormalChecksRepository } from '../repositories/formal-checks-repository.js';
import { instructions, version } from '../ai/prompts/review-v1.js';
import { responseSchema, validateResponse } from '../ai/response.js';
import { createMockProvider } from '../ai/providers/mock.js';
import { callProvider } from '../ai/provider-call.js';

function context(w, p) {
  return requireAuthoredWork(w, p);
}
function build(w, p, repo) {
  const { item, author } = context(w, p),
    copy = repo.reviewed(author.id);
  if (!copy) throw new UserError('Сначала сохраните копию с отметкой «просмотрено».');
  const criteria = repo.keys(copy.id);
  if (!criteria.length)
    throw new UserError(
      'В старой копии нет ключей критериев. Подготовьте новую копию и отметьте её просмотренной.',
    );
  const parsed = JSON.parse(copy.body);
  if (
    !Array.isArray(parsed.assignment?.criteria) ||
    parsed.assignment.criteria.length !== criteria.length
  )
    throw new UserError('Критерии копии изменены. Подготовьте новую копию.');
  const mapped = parsed.assignment.criteria.map((c, i) => {
    if (
      c.key !== criteria[i].key ||
      c.points !== criteria[i].points ||
      typeof c.name !== 'string' ||
      typeof c.description !== 'string'
    )
      throw new UserError('Ключи или максимумы критериев копии изменены. Подготовьте новую копию.');
    return { key: c.key, name: c.name, description: c.description, points: c.points };
  });
  const numbers = new Set();
  if (
    !Array.isArray(parsed.cells) ||
    parsed.cells.some(
      (c) =>
        !Number.isInteger(c.number) ||
        c.number < 1 ||
        numbers.has(c.number) ||
        !numbers.add(c.number) ||
        !['code', 'markdown'].includes(c.type) ||
        typeof c.source !== 'string',
    )
  )
    throw new UserError('Неверные ячейки в просмотренной копии.');
  for (const field of ['title', 'description', 'additional', 'rules'])
    if (typeof parsed.assignment[field] !== 'string')
      throw new UserError('Неверный раздел задания в копии.');
  // Собираем только разрешённые поля просмотренной копии, не добавляем исходник или карточку студента.
  const assignment = Object.fromEntries(
    ['title', 'description', 'additional', 'rules'].map((k) => [k, parsed.assignment[k]]),
  );
  const formal = createFormalChecksRepository(w.connection).history(item.id, author.id)[0];
  const input = {
    assignment: {
      ...assignment,
      criteria: mapped,
      feedbackLanguage: repo.language(item.assignment_revision_id),
    },
    cells: parsed.cells.map((c) => ({ number: c.number, type: c.type, source: c.source })),
    formalChecks: formal?.results ?? [],
  };
  return {
    item,
    author,
    copy,
    criteria,
    request: { instructions, input, schema: responseSchema, model: 'mock-v1' },
  };
}

function prepare(w, p, repo) {
  const b = build(w, p, repo);
  if (p.provider === 'openai') {
    if (!w.aiRuntime?.keyStore) throw new UserError('Настоящий ИИ доступен только в Electron.');
    if (!w.aiRuntime.keyStore.info().hasKey)
      throw new UserError('Сначала сохраните ключ в «Подключении ИИ».');
    b.request.model = repo.preferences().model;
    b.request.wireRequest = openAiBody(b.request);
  } else if (!w.aiDevelopment)
    throw new UserError('Тестовая проверка ИИ доступна только при разработке.');
  return b;
}
export function previewAiCheck(w, p) {
  validateAiCheckInput(p);
  const repo = createAiRepository(w.connection),
    b = prepare(w, p, repo);
  const request = b.request.wireRequest ?? b.request,
    inputTokens = Math.ceil(JSON.stringify(request).length / 4);
  const token = randomUUID();
  for (const [key, v] of w.aiPreviews) if (Date.now() > v.expires) w.aiPreviews.delete(key);
  w.aiPreviews.set(token, {
    profileId: p.profileId,
    importId: p.importId,
    request: JSON.stringify(request),
    expires: Date.now() + 300000,
  });
  return {
    token,
    provider: p.provider ?? 'mock',
    model: b.request.model,
    request,
    inputTokens,
    inputCost: p.provider === 'openai' ? estimateCost(b.request.model, inputTokens) : 0,
    spent: repo.spent(monthStart()),
    monthlyLimit: repo.preferences().monthlyLimit,
  };
}
export function getAiHistory(w, p) {
  const { item, author } = context(w, p);
  return { runs: createAiRepository(w.connection).history(item.id, author.id) };
}
export function cancelAiCheck(w, p) {
  context(w, p);
  const pending = w.aiPending.get(p.requestId);
  if (pending && pending.profileId === p.profileId && pending.importId === p.importId)
    pending.controller.abort();
  return {
    cancelled: Boolean(
      pending && pending.profileId === p.profileId && pending.importId === p.importId,
    ),
  };
}
export async function runAiCheck(w, p, options = {}) {
  validateAiCheckInput(p);
  const repo = createAiRepository(w.connection),
    providerName = p.provider ?? 'mock';
  const id = p.requestId ?? randomUUID();
  if (
    typeof id !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
    repo.get(id) ||
    w.aiPending.has(id)
  )
    throw new UserError('Неверный или повторный идентификатор запуска.');
  const b = prepare(w, p, repo);
  let provider;
  if (providerName === 'openai') {
    const confirmation = w.aiPreviews.get(p.confirmationToken);
    w.aiPreviews.delete(p.confirmationToken);
    if (
      !confirmation ||
      confirmation.profileId !== p.profileId ||
      confirmation.importId !== p.importId ||
      confirmation.expires < Date.now() ||
      confirmation.request !== JSON.stringify(b.request.wireRequest)
    )
      throw new UserError(
        'Запрос изменился или не подтверждён. Просмотрите его и подтвердите отправку заново.',
      );
    if ([...w.aiPending.values()].some((x) => x.provider === 'openai'))
      throw new UserError('Дождитесь завершения текущей проверки OpenAI.');
    const spent = repo.spent(monthStart()),
      limit = repo.preferences().monthlyLimit;
    const estimate = estimateCost(
      b.request.model,
      Math.ceil(JSON.stringify(b.request.wireRequest).length / 4),
    );
    if (spent >= limit || (estimate !== null && spent + estimate > limit))
      throw new UserError('Достигнут месячный лимит расходов приложения.');
    provider = createOpenAiProvider(w.aiRuntime.keyStore.load(), w.aiRuntime.fetch);
  } else provider = createMockProvider(p.scenario);
  w.transaction(() =>
    repo.insert({
      id,
      importId: b.item.id,
      authorId: b.author.id,
      revisionId: b.item.assignment_revision_id,
      copyId: b.copy.id,
      provider: providerName,
      model: b.request.model,
      promptVersion: version,
      request: b.request,
    }),
  );
  w.transaction(() => repo.start(id));
  const controller = new AbortController();
  w.aiPending.set(id, {
    controller,
    profileId: p.profileId,
    importId: p.importId,
    provider: providerName,
  });
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  let response;
  try {
    response = await callProvider(provider, b.request, {
      timeoutMs: providerName === 'openai' ? 120000 : 1000,
      ...options,
      signal: controller.signal,
    });
    const value = validateResponse(response.text, b.criteria, b.request.input.cells);
    w.transaction(() => {
      const current = context(w, p);
      if (current.author.id !== b.author.id)
        throw new UserError('Автор изменился во время проверки.');
      repo.results(id, value, b.criteria);
      repo.finish(id, 'completed', { text: response.text, value, usage: response.usage });
    });
  } catch (error) {
    w.transaction(() =>
      repo.finish(id, 'failed', {
        text: response?.text ?? null,
        usage: response?.usage ?? null,
        error:
          error instanceof UserError ? error.message : 'Не удалось сохранить результаты проверки.',
      }),
    );
  } finally {
    w.aiPending.delete(id);
    options.signal?.removeEventListener('abort', abort);
  }
  const run = repo.get(id);
  w.requireProfile(p.profileId);
  return { id: run.id, status: run.status, error: run.error };
}
