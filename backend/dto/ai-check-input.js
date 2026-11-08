import { UserError } from '../errors.js';
import { scenarios } from '../ai/providers/mock.js';
export function validateAiCheckInput(p) {
  if (
    !p ||
    typeof p !== 'object' ||
    Array.isArray(p) ||
    ['profileId', 'courseId', 'assignmentId', 'importId'].some(
      (k) => typeof p[k] !== 'string' || !p[k],
    ) ||
    (p.provider !== undefined && p.provider !== 'mock') ||
    (p.model !== undefined && p.model !== 'mock-v1') ||
    !scenarios.includes(p.scenario ?? 'valid')
  )
    throw new UserError(
      'Укажите работу текущего курса и тестового поставщика mock с известным сценарием.',
    );
}
