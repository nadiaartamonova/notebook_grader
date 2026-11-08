// Приём ноутбука: проверка, запись оригинала с SHA-256, необязательное назначение автора.
import { UserError } from '../../errors.js';
import { validateSubmissionInput } from '../../dto/submission-input.js';
import { readNotebook } from '../../domain/notebooks.js';
import { newId, nowIso, requireAssignment, requireStudent } from './context.js';
import { assignAuthor } from './author-service.js';

export function importNotebook(store, p) {
  requireAssignment(store, p);
  validateSubmissionInput(p);
  if (p.studentId) {
    const enrollment = requireStudent(store, p);
    const current = store.repositories.submissions.countCurrentWorks(p.assignmentId, enrollment.id);
    if (current && p.confirmNewVersion !== true)
      throw new UserError('Подтвердите сохранение новой версии работы студента.');
  }
  const bytes = Buffer.from(p.base64, 'base64'),
    notebook = readNotebook(bytes);
  const importId = newId(),
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
    nowIso(),
  );
  try {
    store.files.saveOriginal(key, bytes);
    store.repositories.submissions.markReady(importId);
    if (p.studentId) assignAuthor(store, { ...p, importId });
  } catch {
    // Транзакция откатит записи; уже записанные байты не удаляем при ошибке.
    throw new UserError(
      'Не удалось завершить импорт. Записи не сохранены. Повторите загрузку; исходный файл не изменён.',
    );
  }
  return store.snapshot();
}

// При запуске: незавершённые импорты восстанавливаются из staging или помечаются ошибкой.
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
