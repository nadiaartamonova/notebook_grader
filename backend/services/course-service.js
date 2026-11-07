import { randomUUID } from 'node:crypto';
import { UserError } from '../errors.js';
import { text } from '../dto/validation.js';
import { courseInput } from '../dto/course-input.js';
import { assignmentInput } from '../dto/assignment-input.js';
const id = () => randomUUID();
const now = () => new Date().toISOString();
export function createCourse(workspace, p) {
  workspace.requireProfile(p.profileId);
  const courseId = workspace.insertCourse(p.profileId, courseInput(p));
  workspace.addRules(courseId, '');
}

export function copyCourse(workspace, p) {
  workspace.requireCourse(p.profileId, p.sourceId);
  const values = courseInput(p);
  const courseId = workspace.insertCourse(p.profileId, values, p.sourceId);
  const rulesId = workspace.addRules(courseId, workspace.latestRules(p.sourceId).content);
  for (const a of workspace.assignmentRows(p.sourceId)) {
    const assignmentId = id();
    workspace.repositories.assignments.insert(assignmentId, courseId, now());
    workspace.insertAssignmentRevision(assignmentId, rulesId, assignmentInput(a));
  }
}

export function saveRules(workspace, p) {
  workspace.requireCourse(p.profileId, p.courseId);
  const content = text(p.content, 'Правила курса', 100000, true);
  if (workspace.latestRules(p.courseId).id !== p.expectedRevision)
    throw new UserError('Правила уже изменены. Откройте их заново перед сохранением.');
  if (content !== workspace.latestRules(p.courseId).content)
    workspace.addRules(p.courseId, content);
}
