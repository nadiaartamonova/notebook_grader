import { aiSettingsCommands, aiSettingsCommand } from './ai-settings-service.js';
import { runAiCheck, previewAiCheck, cancelAiCheck, getAiHistory } from './ai-service.js';
import { createAiRepository } from '../repositories/ai-repository.js';
import { getFormalChecks, runFormalChecks } from './formal-checks-service.js';
import { createFormalChecksRepository } from '../repositories/formal-checks-repository.js';
import { getReview, saveReview, reviewSummary, copyReviewText } from './review-service.js';
import { createCourse, copyCourse, saveRules } from './course-service.js';
import { addStudent, editStudent, excludeStudent } from './student-service.js';
import { saveAssignment, archiveAssignment, restoreAssignment } from './assignment-service.js';
const workspaceCommands = {
  createCourse,
  copyCourse,
  saveRules,
  addStudent,
  editStudent,
  excludeStudent,
  saveAssignment,
  archiveAssignment,
  restoreAssignment,
};
import { randomUUID } from 'node:crypto';
import { UserError } from '../errors.js';
import { toCriterionDto, toAssignmentDto, toCourseDto } from '../mappers/workspace-mapper.js';
import { submissionCommand, submissionCommands } from './submission-service.js';
const id = () => randomUUID();
const now = () => new Date().toISOString();
export class WorkspaceService {
  constructor(connection, repositories, files, auth) {
    this.connection = connection;
    this.repositories = repositories;
    this.files = files;
    this.auth = auth;
  }
  transaction(fn) {
    return this.connection.transaction(fn);
  }
  active() {
    return this.auth.active;
  }
  requireProfile(profileId) {
    if (
      typeof profileId !== 'string' ||
      profileId !== this.active() ||
      !this.repositories.profiles.find(profileId)
    ) {
      throw new UserError('Профиль изменился. Обновите страницу и повторите действие.');
    }
  }
  requireCourse(profileId, courseId) {
    this.requireProfile(profileId);
    const course =
      typeof courseId === 'string' && this.repositories.courses.findOwned(courseId, profileId);
    if (!course) throw new UserError('Курс не найден в текущем профиле.');
    return course;
  }
  latestRules(courseId) {
    return this.repositories.courses.latestRules(courseId);
  }
  addRules(courseId, content) {
    const revisionId = id();
    this.repositories.courses.insertRules(
      revisionId,
      courseId,
      (this.latestRules(courseId)?.version || 0) + 1,
      content,
      now(),
    );
    return revisionId;
  }
  insertCourse(profileId, values, source = null) {
    const courseId = id();
    this.repositories.courses.insert(
      courseId,
      profileId,
      values.name,
      values.group,
      values.year,
      values.semester,
      values.mode,
      source,
      now(),
    );
    return courseId;
  }
  insertAssignmentRevision(assignmentId, rulesId, values) {
    const revId = id();
    const version = (this.repositories.assignments.maxVersion(assignmentId).version || 0) + 1;
    this.repositories.assignments.insertRevision(
      revId,
      assignmentId,
      version,
      values.name,
      values.description,
      values.additional,
      rulesId,
      now(),
    );
    createFormalChecksRepository(this.connection).insertSettings(revId, values.formalChecks);
    createAiRepository(this.connection).addLanguage(revId, values.feedbackLanguage);
    values.criteria.forEach((c, position) =>
      this.repositories.assignments.insertCriterion(
        id(),
        revId,
        position,
        c.name,
        c.description,
        c.halfPoints,
      ),
    );
    return revId;
  }
  assignmentRows(courseId) {
    return this.repositories.assignments.listLatest(courseId).map((a) => {
      const criteria = this.repositories.assignments
        .listCriteria(a.revision_id)
        .map(toCriterionDto);
      return toAssignmentDto(
        {
          ...a,
          formalChecks: createFormalChecksRepository(this.connection).settings(a.revision_id),
          feedbackLanguage: createAiRepository(this.connection).language(a.revision_id),
        },
        criteria,
        this.repositories.submissions.listWorks(a.id).map((work) => {
          const repo = createAiRepository(this.connection),
            copy = work.authorEventId ? repo.reviewed(work.authorEventId) : null;
          return {
            ...work,
            ...reviewSummary(this, work.authorEventId),
            aiReady: Boolean(copy && repo.keys(copy.id).length),
          };
        }),
      );
    });
  }
  snapshot() {
    const profiles = this.repositories.profiles.list();
    const active = this.active();
    const courses = active
      ? this.repositories.courses.listOwned(active).map((c) => {
          const rules = this.latestRules(c.id);
          return toCourseDto(
            c,
            rules,
            this.repositories.students.listEnrolled(c.id),
            this.assignmentRows(c.id),
          );
        })
      : [];
    return { profiles, active, courses, passwordPolicy: this.auth.policy };
  }

  dispatch(command, p = {}) {
    if (!p || typeof p !== 'object' || Array.isArray(p))
      throw new UserError('Неверный формат команды.');
    if (command === 'copyReviewText') return copyReviewText(this, p);
    if (aiSettingsCommands.has(command)) return aiSettingsCommand(this, command, p);
    if (command === 'previewAiCheck') return previewAiCheck(this, p);
    if (command === 'cancelAiCheck') return cancelAiCheck(this, p);
    if (command === 'getAiHistory') return getAiHistory(this, p);
    if (command === 'runAiCheck') return runAiCheck(this, p);
    if (command === 'getFormalChecks') return getFormalChecks(this, p);
    if (command === 'runFormalChecks') return runFormalChecks(this, p);
    if (command === 'getReview') return getReview(this, p);
    if (command === 'saveReview') return saveReview(this, p);
    if (command === 'state') return this.snapshot();
    if (submissionCommands.has(command)) return submissionCommand(this, command, p);
    const handler = workspaceCommands[command];
    if (!Object.hasOwn(workspaceCommands, command)) throw new UserError('Неизвестная команда.');
    this.transaction(() => handler(this, p));
    return this.snapshot();
  }
}
