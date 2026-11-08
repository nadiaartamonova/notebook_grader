// Общие проверки для действий с работой: задание в курсе текущего профиля, работа в задании,
// студент в группе, назначенный автор. Используются всеми сервисами работ, оценки и проверок.
import { randomUUID } from 'node:crypto';
import { UserError } from '../../errors.js';

export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();

export function requireAssignment(store, p) {
  store.requireCourse(p.profileId, p.courseId);
  const assignment =
    typeof p.assignmentId === 'string' &&
    store.repositories.assignments.findInCourse(p.assignmentId, p.courseId);
  if (!assignment) throw new UserError('Задание не найдено в текущем курсе.');
  return assignment;
}

export function requireStudent(store, p) {
  const enrollment =
    typeof p.studentId === 'string' &&
    store.repositories.students.findEnrollment(p.courseId, p.studentId);
  if (!enrollment) throw new UserError('Выберите студента текущей группы.');
  return enrollment;
}

export function requireImport(store, p) {
  requireAssignment(store, p);
  const item =
    typeof p.importId === 'string' &&
    store.repositories.submissions.findImport(p.importId, p.assignmentId);
  if (!item) throw new UserError('Работа не найдена в этом задании.');
  return item;
}

// Готовая работа с назначенным автором — условие для копии, проверок, ИИ и оценки.
export function requireAuthoredWork(store, p) {
  requireAssignment(store, p);
  const item =
    typeof p.importId === 'string' &&
    store.repositories.submissions.findImport(p.importId, p.assignmentId);
  if (!item || item.status !== 'ready') throw new UserError('Работа не найдена или недоступна.');
  const author = store.repositories.submissions.currentAuthor(item.id);
  if (!author) throw new UserError('Сначала назначьте автора работы.');
  return { item, author };
}
