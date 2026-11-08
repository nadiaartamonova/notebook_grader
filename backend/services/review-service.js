import { text } from '../dto/validation.js';
import { randomUUID } from 'node:crypto';
import { UserError } from '../errors.js';
import { reviewInput } from '../dto/review-input.js';
import { createReviewRepository } from '../repositories/review-repository.js';
import { createAiRepository } from '../repositories/ai-repository.js';

function context(workspace, p) {
  workspace.requireCourse(p.profileId, p.courseId);
  if (!workspace.repositories.assignments.findInCourse(p.assignmentId, p.courseId))
    throw new UserError('Задание не найдено.');
  const item = workspace.repositories.submissions.findImport(p.importId, p.assignmentId);
  if (!item || item.status !== 'ready') throw new UserError('Работа не найдена или недоступна.');
  const author = workspace.repositories.submissions.currentAuthor(item.id);
  if (!author) throw new UserError('Сначала назначьте автора работы.');
  const criteria = workspace.repositories.assignments.listCriteria(item.assignment_revision_id);
  return { item, author, criteria, repo: createReviewRepository(workspace.connection) };
}
function read(repo, review) {
  if (!review) return null;
  const scores = repo.scores(review.id);
  return {
    ...review,
    scores: scores.map((s) => ({ ...s, points: s.halfPoints === null ? null : s.halfPoints / 2 })),
    total: scores.reduce((sum, s) => sum + (s.halfPoints ?? 0), 0) / 2,
  };
}
export function reviewSummary(workspace, eventId) {
  if (!eventId)
    return {
      reviewStatus: 'ungraded',
      teacherScore: null,
      draftScore: null,
      aiScore: null,
      aiStatus: null,
      formal: null,
    };
  const repo = createReviewRepository(workspace.connection),
    latest = repo.latest(eventId),
    approved = read(repo, repo.latest(eventId, true)),
    ai = createAiRepository(workspace.connection);
  // Сводка последнего запуска формальных проверок: сколько не пройдено.
  const formalRun = workspace.connection.get(
    'SELECT results_json FROM formal_check_runs WHERE author_event_id=? ORDER BY rowid DESC LIMIT 1',
    eventId,
  );
  const formalResults = formalRun ? JSON.parse(formalRun.results_json) : null;
  return {
    reviewStatus: latest?.status ?? 'ungraded',
    teacherScore: approved?.total ?? null,
    draftScore: latest?.status === 'draft' ? read(repo, latest).total : null,
    aiScore: ai.latestCompleted(eventId)?.total ?? null,
    aiStatus: ai.latestStatus(eventId),
    formal: formalResults && {
      failed: formalResults.filter((r) => r.status === 'failed').length,
      passed: formalResults.filter((r) => r.status === 'passed').length,
    },
  };
}
export function getReview(workspace, p) {
  const { item, author, criteria, repo } = context(workspace, p);
  return {
    authorEventId: author.id,
    assignmentRevisionId: item.assignment_revision_id,
    criteria: criteria.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      max: c.half_points / 2,
    })),
    current: read(repo, repo.latest(author.id)),
    approved: read(repo, repo.latest(author.id, true)),
    history: repo.history(author.id),
    aiProposal: createAiRepository(workspace.connection).latestCompleted(author.id),
    feedbackLanguage: createAiRepository(workspace.connection).language(
      item.assignment_revision_id,
    ),
  };
}
export function saveReview(workspace, p) {
  return workspace.transaction(() => {
    const { item, author, criteria, repo } = context(workspace, p);
    if (author.id !== p.expectedAuthorEventId)
      throw new UserError('Автор изменился. Откройте оценку заново.');
    const previous = repo.latest(author.id);
    if ((previous?.id ?? null) !== (p.expectedReviewId ?? null))
      throw new UserError('Оценка уже изменена. Откройте её заново.');
    const values = reviewInput(p, criteria),
      id = randomUUID();
    repo.insert({
      id,
      importId: item.id,
      eventId: author.id,
      assignmentRevisionId: item.assignment_revision_id,
      revision: (previous?.revision ?? 0) + 1,
      previousId: previous?.id ?? null,
      status: values.status,
      feedback: values.feedback,
      profileId: p.profileId,
      createdAt: new Date().toISOString(),
    });
    for (const score of values.scores) repo.insertScore(id, score);
    return getReview(workspace, p);
  });
}

export function copyReviewText(workspace, p) {
  context(workspace, p);
  return { text: text(p.text, 'Текст отзыва', 600000, true) };
}
