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
  w.requireCourse(p.profileId, p.courseId);
  if (
    typeof p.assignmentId !== 'string' ||
    !w.repositories.assignments.findInCourse(p.assignmentId, p.courseId)
  )
    throw new UserError('Задание не найдено.');
  const item =
    typeof p.importId === 'string' &&
    w.repositories.submissions.findImport(p.importId, p.assignmentId);
  if (!item || item.status !== 'ready') throw new UserError('Работа недоступна.');
  const author = w.repositories.submissions.currentAuthor(item.id);
  if (!author) throw new UserError('Сначала назначьте автора.');
  return { item, author };
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
export async function runAiCheck(w, p, options = {}) {
  if (!w.aiDevelopment) throw new UserError('Тестовая проверка ИИ доступна только при разработке.');
  validateAiCheckInput(p);
  const repo = createAiRepository(w.connection),
    id = randomUUID();
  const prepared = w.transaction(() => {
    const b = build(w, p, repo);
    repo.insert({
      id,
      importId: b.item.id,
      authorId: b.author.id,
      revisionId: b.item.assignment_revision_id,
      copyId: b.copy.id,
      model: 'mock-v1',
      promptVersion: version,
      request: b.request,
    });
    return b;
  });
  w.transaction(() => repo.start(id));
  let response;
  try {
    response = await callProvider(createMockProvider(p.scenario), prepared.request, options);
    const value = validateResponse(response.text, prepared.criteria, prepared.request.input.cells);
    w.transaction(() => {
      const current = context(w, p);
      if (current.author.id !== prepared.author.id)
        throw new UserError('Автор изменился во время проверки.');
      repo.results(id, value, prepared.criteria);
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
  }
  const run = repo.get(id);
  // При смене профиля не возвращаем данные прошлого профиля в новое рабочее пространство.
  w.requireProfile(p.profileId);
  return { id: run.id, status: run.status, error: run.error };
}
