import { UserError } from '../errors.js';
export function validateAuthorChange(p) {
  if (
    typeof p.studentId !== 'string' ||
    !p.studentId ||
    typeof p.expectedAuthorEventId !== 'string'
  )
    throw new UserError('Выберите нового автора и откройте актуальную работу.');
}
export function requireConfirmation(value, message) {
  if (value !== true) throw new UserError(message);
}
