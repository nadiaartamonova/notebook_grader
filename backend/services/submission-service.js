import { createAiRepository } from '../repositories/ai-repository.js';
import { validateAuthorChange, requireConfirmation } from '../dto/work-action-input.js';
import { validateSubmissionInput } from '../dto/submission-input.js';
import { randomUUID } from 'node:crypto';
import { UserError } from '../errors.js';
import { readNotebook, preparePayload } from '../domain/notebooks.js';

const id = () => randomUUID(),
  now = () => new Date().toISOString();
function requireAssignment(store, p) {
  store.requireCourse(p.profileId, p.courseId);
  const a =
    typeof p.assignmentId === 'string' &&
    store.repositories.assignments.findInCourse(p.assignmentId, p.courseId);
  if (!a) throw new UserError('Задание не найдено в текущем курсе.');
  return a;
}
function requireStudent(store, p) {
  const enrollment =
    typeof p.studentId === 'string' &&
    store.repositories.students.findEnrollment(p.courseId, p.studentId);
  if (!enrollment) throw new UserError('Выберите студента текущей группы.');
  return enrollment;
}
function requireImport(store, p) {
  requireAssignment(store, p);
  const item =
    typeof p.importId === 'string' &&
    store.repositories.submissions.findImport(p.importId, p.assignmentId);
  if (!item) throw new UserError('Работа не найдена в этом задании.');
  return item;
}
export function recoverImports(store) {
  for (const item of store.repositories.submissions.listPending()) {
    try {
      store.files.recover(item);
      store.repositories.submissions.markRecovered(item.id);
    } catch {
      store.repositories.submissions.markFailed(
        'Импорт был прерван. Исходный файл необходимо загрузить заново.',
        item.id,
      );
    }
  }
}

function assign(store, p, changing = false) {
  const item = requireImport(store, p),
    enrollment = requireStudent(store, p);
  const repo = store.repositories.submissions;
  if (item.status !== 'ready') throw new UserError('Сначала необходимо завершить импорт файла.');
  const previous = repo.currentAuthor(item.id);
  if (changing) {
    validateAuthorChange(p);
    if (!previous || previous.id !== p.expectedAuthorEventId)
      throw new UserError('Автор уже изменён. Откройте работу заново.');
    if (previous.student_id === p.studentId)
      throw new UserError('Этот студент уже назначен автором.');
  } else if (previous) throw new UserError('Автор уже назначен. Используйте «Изменить автора».');
  let submission = repo.findSubmission(p.assignmentId, enrollment.id);
  const previousCount = submission ? repo.countVersions(submission.id).n : 0;
  if (previousCount)
    requireConfirmation(
      p.confirmNewVersion,
      'У студента уже есть работа или история сдач. Подтвердите сохранение новой версии.',
    );
  if (!submission) {
    submission = { id: id() };
    repo.insertSubmission(submission.id, p.assignmentId, enrollment.id);
  }
  const eventId = id(),
    createdAt = now();
  if (!previous) repo.insertVersion(eventId, submission.id, previousCount + 1, item.id, createdAt);
  const student = store.repositories.students.findOwned(p.studentId, p.profileId);
  repo.insertAuthorEvent({
    id: eventId,
    importId: item.id,
    submissionId: submission.id,
    version: previousCount + 1,
    previousId: previous?.id ?? null,
    name: student.name,
    number: student.student_number,
    profileId: p.profileId,
    createdAt,
  });
  if (previous) repo.invalidateCopies(item.id, 'Автор работы изменён', createdAt);
}

export function importNotebook(store, p) {
  requireAssignment(store, p);
  validateSubmissionInput(p);
  if (p.studentId) {
    const e = requireStudent(store, p);
    const previous = store.repositories.submissions.findSubmission(p.assignmentId, e.id);
    if (previous && p.confirmNewVersion !== true)
      throw new UserError('Подтвердите сохранение новой версии работы студента.');
  }
  const bytes = Buffer.from(p.base64, 'base64'),
    notebook = readNotebook(bytes);
  const importId = id(),
    key = `${importId}.ipynb`,
    sha = store.files.hash(bytes);
  const revision = store.repositories.assignments.latestRevisionId(p.assignmentId);
  store.repositories.submissions.insertImport(
    importId,
    p.assignmentId,
    revision.id,
    p.name,
    key,
    sha,
    bytes.length,
    notebook.cells.length,
    'pending',
    '',
    now(),
  );
  try {
    store.files.saveOriginal(key, bytes);
    store.repositories.submissions.markReady(importId);
    if (p.studentId) assign(store, { ...p, importId });
  } catch {
    // Транзакция откатит записи; уже записанные байты не удаляем при ошибке.
    throw new UserError(
      'Не удалось завершить импорт. Записи не сохранены. Повторите загрузку; исходный файл не изменён.',
    );
  }
  return store.snapshot();
}

function executeSubmissionCommand(store, command, p) {
  if (command === 'importNotebook') return importNotebook(store, p);
  if (command === 'assignSubmission' || command === 'changeSubmissionAuthor') {
    assign(store, p, command === 'changeSubmissionAuthor');
    return store.snapshot();
  }
  const item = requireImport(store, p);
  if (command === 'deleteSubmission') {
    requireConfirmation(p.confirmDelete, 'Подтвердите удаление работы.');
    store.repositories.submissions.deleteWork(item.id, p.profileId, now());
    store.repositories.submissions.invalidateCopies(item.id, 'Работа удалена', now());
    return store.snapshot();
  }
  if (command === 'getSubmissionHistory')
    return {
      authors: store.repositories.submissions.authorHistory(item.id),
      copies: store.repositories.submissions.copyHistory(item.id),
    };
  if (command === 'readSubmission') {
    const notebook = readNotebook(store.files.readOriginal(item));
    return {
      file: item.original_name,
      cells: notebook.cells.map((c, i) => ({
        number: i + 1,
        type: c.cell_type,
        source: Array.isArray(c.source) ? c.source.join('') : c.source,
      })),
      excluded: 'Выводы, вложения и HTML не исполняются и не отображаются.',
    };
  }
  const version = store.repositories.submissions.findAuthorVersion(item.id);
  if (!version) throw new UserError('Сначала назначьте автора работы.');
  const latest = () => store.repositories.submissions.latestCopy(version.authorEventId);
  if (command === 'getPreparedCopy') return latest() || null;
  if (command === 'prepareSubmission') {
    const existing = latest();
    if (
      existing &&
      createAiRepository(store.connection).keys(existing.id).length &&
      p.regenerate !== true
    )
      return existing; // Сохраняем ручные правки; старую копию без ключей заменяет новая редакция.
    const notebook = readNotebook(store.files.readOriginal(item));
    const revision = store.repositories.assignments.findRevision(item.assignment_revision_id);
    const assignment = {
      ...revision,
      rules: store.repositories.courses.findRules(revision.rule_revision_id).content,
      criteria: store.repositories.assignments
        .listCriteria(revision.id)
        .map((c) => ({ ...c, points: c.half_points / 2 })),
    };
    const requestId = id(),
      result = preparePayload(notebook, version, assignment, requestId, item.original_name);
    const copyId = id();
    store.repositories.submissions.insertCopy(
      copyId,
      version.id,
      store.repositories.submissions.nextCopyRevision(version.id),
      requestId,
      result.body,
      JSON.stringify(result.findings),
      0,
      now(),
    );
    store.repositories.submissions.linkCopy(copyId, version.authorEventId);
    createAiRepository(store.connection).linkKeys(copyId, assignment.criteria);
    return latest();
  }
  if (command === 'savePreparedCopy') {
    const current = latest();
    if (!current || current.id !== p.expectedId)
      throw new UserError('Копия уже изменена. Откройте её заново.');
    if (typeof p.body !== 'string' || !p.body.trim() || Buffer.byteLength(p.body) > 8 * 1024 * 1024)
      throw new UserError('Подготовленный текст пуст или превышает 8 МБ.');
    let parsed;
    try {
      parsed = JSON.parse(p.body);
    } catch {
      throw new UserError(
        'Сохраните корректный JSON: проверьте кавычки и запятые после редактирования.',
      );
    }
    if (
      !parsed ||
      parsed.requestId !== current.request_id ||
      !Array.isArray(parsed.cells) ||
      !parsed.assignment
    )
      throw new UserError('Не удаляйте идентификатор проверки, раздел задания и список ячеек.');
    const copyId = id();
    store.repositories.submissions.insertCopy(
      copyId,
      version.id,
      current.revision + 1,
      current.request_id,
      p.body,
      current.findings,
      p.reviewed === true ? 1 : 0,
      now(),
    );
    store.repositories.submissions.linkCopy(copyId, version.authorEventId);
    createAiRepository(store.connection).linkKeys(
      copyId,
      createAiRepository(store.connection).keys(current.id),
    );
    return latest();
  }
  throw new UserError('Неизвестное действие с работой.');
}

export const submissionCommands = new Set([
  'importNotebook',
  'assignSubmission',
  'changeSubmissionAuthor',
  'deleteSubmission',
  'getSubmissionHistory',
  'readSubmission',
  'prepareSubmission',
  'getPreparedCopy',
  'savePreparedCopy',
]);

const changingCommands = new Set([
  'importNotebook',
  'assignSubmission',
  'changeSubmissionAuthor',
  'deleteSubmission',
  'prepareSubmission',
  'savePreparedCopy',
]);
export function submissionCommand(store, command, p) {
  return changingCommands.has(command)
    ? store.transaction(() => executeSubmissionCommand(store, command, p))
    : executeSubmissionCommand(store, command, p);
}
