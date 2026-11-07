import { randomUUID } from 'node:crypto';
import { UserError } from '../errors.js';
import { studentInput } from '../dto/student-input.js';
import { requireConfirmation } from '../dto/work-action-input.js';
const id = () => randomUUID();
const now = () => new Date().toISOString();
export function addStudent(workspace, p) {
  workspace.requireCourse(p.profileId, p.courseId);
  const { name, number } = studentInput(p);
  let student = number ? workspace.repositories.students.findByNumber(p.profileId, number) : null;
  if (student && student.name !== name)
    throw new UserError('Этот учебный номер уже принадлежит студенту с другим именем.');
  if (!student) {
    student = { id: id() };
    workspace.repositories.students.insert(student.id, p.profileId, name, number, now());
  }
  const existing = workspace.repositories.students.findEnrollmentId(p.courseId, student.id);
  if (workspace.repositories.students.findEnrollment(p.courseId, student.id))
    throw new UserError('Студент уже добавлен в эту группу.');
  if (existing) workspace.repositories.students.setEnrollmentActive(existing.id, 1);
  else workspace.repositories.students.enroll(id(), p.courseId, student.id);
}

function requireEnrolledStudent(workspace, p) {
  workspace.requireCourse(p.profileId, p.courseId);
  const student =
    typeof p.studentId === 'string' &&
    workspace.repositories.students.findOwned(p.studentId, p.profileId);
  const enrollment =
    student && workspace.repositories.students.findEnrollment(p.courseId, p.studentId);
  if (!enrollment) throw new UserError('Студент не найден в текущей группе.');
  return { student, enrollment };
}
export function editStudent(workspace, p) {
  requireEnrolledStudent(workspace, p);
  const { name, number } = studentInput(p);
  const duplicate = number && workspace.repositories.students.findByNumber(p.profileId, number);
  if (duplicate && duplicate.id !== p.studentId)
    throw new UserError('Этот учебный номер уже принадлежит другому студенту.');
  workspace.repositories.students.update(p.studentId, name, number);
}
export function excludeStudent(workspace, p) {
  const { enrollment } = requireEnrolledStudent(workspace, p);
  requireConfirmation(p.confirmExclude, 'Подтвердите исключение студента из группы.');
  if (workspace.repositories.students.hasCurrentWork(enrollment.id))
    throw new UserError(
      'У студента есть работы в этом курсе. Сначала переназначьте или удалите их.',
    );
  workspace.repositories.students.setEnrollmentActive(enrollment.id, 0);
}
