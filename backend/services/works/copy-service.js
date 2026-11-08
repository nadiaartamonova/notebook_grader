// Копия для ИИ: обезличенный текст работы и задания. Каждое сохранение — новая редакция;
// ручные правки преподавателя никогда не перезаписываются автоматически.
import { UserError } from '../../errors.js';
import { readNotebook, preparePayload } from '../../domain/notebooks.js';
import { parsePreparedCopy } from '../../dto/prepared-copy-input.js';
import { createAiRepository } from '../../repositories/ai-repository.js';
import { newId, nowIso, requireImport } from './context.js';

function copyContext(store, p) {
  const item = requireImport(store, p);
  const version = store.repositories.submissions.findAuthorVersion(item.id);
  if (!version) throw new UserError('Сначала назначьте автора работы.');
  const latest = () => store.repositories.submissions.latestCopy(version.authorEventId);
  return { item, version, latest, ai: createAiRepository(store.connection) };
}

function assignmentForCopy(store, item) {
  const revision = store.repositories.assignments.findRevision(item.assignment_revision_id);
  return {
    ...revision,
    rules: store.repositories.courses.findRules(revision.rule_revision_id).content,
    criteria: store.repositories.assignments
      .listCriteria(revision.id)
      .map((c) => ({ ...c, points: c.half_points / 2 })),
  };
}

function insertCopy(store, version, values) {
  const copyId = newId();
  store.repositories.submissions.insertCopy(
    copyId,
    version.id,
    values.revision,
    values.requestId,
    values.body,
    values.findings,
    values.reviewed ? 1 : 0,
    nowIso(),
  );
  store.repositories.submissions.linkCopy(copyId, version.authorEventId);
  return copyId;
}

export function getPreparedCopy(store, p) {
  return copyContext(store, p).latest() || null;
}

export function prepareCopy(store, p) {
  const { item, version, latest, ai } = copyContext(store, p);
  const existing = latest();
  // Сохраняем ручные правки; старую копию без ключей критериев заменяет новая редакция.
  if (existing && ai.keys(existing.id).length && p.regenerate !== true) return existing;
  const notebook = readNotebook(store.files.readOriginal(item));
  const assignment = assignmentForCopy(store, item);
  const requestId = newId(),
    result = preparePayload(notebook, version, assignment, requestId, item.original_name);
  const copyId = insertCopy(store, version, {
    revision: store.repositories.submissions.nextCopyRevision(version.id),
    requestId,
    body: result.body,
    findings: JSON.stringify(result.findings),
    reviewed: false,
  });
  ai.linkKeys(copyId, assignment.criteria);
  return latest();
}

export function saveCopy(store, p) {
  const { version, latest, ai } = copyContext(store, p);
  const current = latest();
  if (!current || current.id !== p.expectedId)
    throw new UserError('Копия уже изменена. Откройте её заново.');
  parsePreparedCopy(p.body, current.request_id);
  const copyId = insertCopy(store, version, {
    revision: current.revision + 1,
    requestId: current.request_id,
    body: p.body,
    findings: current.findings,
    reviewed: p.reviewed === true,
  });
  ai.linkKeys(copyId, ai.keys(current.id));
  return latest();
}
