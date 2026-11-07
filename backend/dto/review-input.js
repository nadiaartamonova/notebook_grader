import { UserError } from '../errors.js';
import { text } from './validation.js';
export function reviewInput(p, criteria) {
  if (!['draft', 'approved'].includes(p.status) || !Array.isArray(p.scores))
    throw new UserError('Проверьте состояние и баллы оценки.');
  const seen = new Set();
  for (const score of p.scores) {
    if (!score || seen.has(score.criterionId) || !criteria.some((c) => c.id === score.criterionId))
      throw new UserError('Неверный или повторяющийся критерий.');
    seen.add(score.criterionId);
  }
  const scores = criteria.map((criterion) => {
    const score = p.scores.find((s) => s.criterionId === criterion.id);
    const empty =
      score?.points == null || (typeof score.points === 'string' && !score.points.trim());
    if (empty && p.status === 'approved')
      throw new UserError('Для утверждения заполните баллы по всем критериям.');
    if (!empty && !['string', 'number'].includes(typeof score.points))
      throw new UserError('Баллы должны быть числом с шагом 0,5.');
    const units = empty ? null : Number(score.points) * 2;
    if (!empty && (!Number.isInteger(units) || units < 0 || units > criterion.half_points))
      throw new UserError(
        `Критерий «${criterion.name}»: балл от 0 до ${criterion.half_points / 2}, шаг 0,5.`,
      );
    return {
      criterionId: criterion.id,
      halfPoints: units,
      comment: text(score?.comment ?? '', 'Комментарий', 10000, true),
    };
  });
  return { status: p.status, feedback: text(p.feedback ?? '', 'Отзыв', 50000, true), scores };
}
