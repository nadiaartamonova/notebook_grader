import { createFormalChecksRepository } from '../repositories/formal-checks-repository.js';
import { randomUUID } from 'node:crypto';
import { UserError } from '../errors.js';
import { assignmentInput } from '../dto/assignment-input.js';
const id = () => randomUUID();
const now = () => new Date().toISOString();
export function saveAssignment(workspace, p) {
  workspace.requireCourse(p.profileId, p.courseId);
  const values = assignmentInput(p);
  let assignmentId = p.id;
  if (assignmentId) {
    if (
      typeof assignmentId !== 'string' ||
      !workspace.repositories.assignments.findInCourse(assignmentId, p.courseId)
    )
      throw new UserError('Задание не найдено.');
    const latest = workspace.repositories.assignments.latestRevisionId(assignmentId);
    if (p.formalChecks === undefined)
      values.formalChecks = createFormalChecksRepository(workspace.connection).settings(latest.id);
    if (latest.id !== p.expectedRevision)
      throw new UserError('Задание уже изменено. Откройте его заново перед сохранением.');
  } else {
    assignmentId = id();
    workspace.repositories.assignments.insert(assignmentId, p.courseId, now());
  }
  workspace.insertAssignmentRevision(assignmentId, workspace.latestRules(p.courseId).id, values);
}

// Архивирование меняет только видимость задания, не его версии и работы.
export function archiveAssignment(workspace, p) {
  workspace.requireCourse(p.profileId, p.courseId);
  if (!workspace.repositories.assignments.findInCourse(p.assignmentId, p.courseId))
    throw new UserError('Задание не найдено.');
  if (p.confirmArchive !== true) throw new UserError('Подтвердите архивирование задания.');
  workspace.repositories.assignments.setArchived(p.assignmentId, 1);
}
export function restoreAssignment(workspace, p) {
  workspace.requireCourse(p.profileId, p.courseId);
  if (!workspace.repositories.assignments.findInCourse(p.assignmentId, p.courseId))
    throw new UserError('Задание не найдено.');
  workspace.repositories.assignments.setArchived(p.assignmentId, 0);
}
