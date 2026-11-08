import { checkSettings } from '../checks/settings.js';
import { UserError } from '../errors.js';
import { text } from './validation.js';
export function assignmentInput(p) {
  if (!Array.isArray(p.criteria) || p.criteria.length < 1 || p.criteria.length > 50)
    throw new UserError('Добавьте от 1 до 50 критериев.');
  const criteria = p.criteria.map((c) => {
    const units = Number(c.points) * 2;
    if (!Number.isInteger(units) || units < 1 || units > 2000)
      throw new UserError('Баллы: от 0,5 до 1000, с шагом 0,5.');
    return {
      name: text(c.name, 'Критерий', 150),
      description: text(c.description ?? '', 'Пояснение критерия', 10000, true),
      halfPoints: units,
    };
  });
  return {
    name: text(p.name, 'Название задания', 120),
    description: text(p.description ?? '', 'Условие', 100000, true),
    additional: text(p.additional ?? '', 'Дополнительные требования', 50000, true),
    criteria,
    formalChecks: checkSettings(p.formalChecks),
    feedbackLanguage: text(p.feedbackLanguage ?? 'эстонский', 'Язык отзыва', 80),
  };
}
