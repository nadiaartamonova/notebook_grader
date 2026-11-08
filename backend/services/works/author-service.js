// Автор работы: первое назначение, исправление ошибочного автора, удаление работы.
// История назначений неизменяема: каждое изменение — новое событие.
import { UserError } from '../../errors.js';
import { validateAuthorChange, requireConfirmation } from '../../dto/work-action-input.js';
import { newId, nowIso, requireImport, requireStudent } from './context.js';

export function assignAuthor(store, p, changing = false) {
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
  // Номер сдачи продолжает историю, а подтверждение нужно только при действующей работе студента.
  const previousCount = submission ? repo.countVersions(submission.id).n : 0;
  if (repo.countCurrentWorks(p.assignmentId, enrollment.id))
    requireConfirmation(
      p.confirmNewVersion,
      'У студента уже есть работа по этому заданию. Подтвердите сохранение новой версии.',
    );
  if (!submission) {
    submission = { id: newId() };
    repo.insertSubmission(submission.id, p.assignmentId, enrollment.id);
  }
  const eventId = newId(),
    createdAt = nowIso();
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
  return store.snapshot();
}

export function changeAuthor(store, p) {
  return assignAuthor(store, p, true);
}

export function deleteWork(store, p) {
  const item = requireImport(store, p);
  requireConfirmation(p.confirmDelete, 'Подтвердите удаление работы.');
  store.repositories.submissions.deleteWork(item.id, p.profileId, nowIso());
  store.repositories.submissions.invalidateCopies(item.id, 'Работа удалена', nowIso());
  return store.snapshot();
}
