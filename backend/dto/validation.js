import { UserError } from '../errors.js';
export function text(value, label, max = 200, optional = false) {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) {
    throw new UserError(`Проверьте поле «${label}» (до ${max} символов).`);
  }
  return value.trim();
}
export function choice(value, values, label) {
  if (!values.includes(value)) throw new UserError(`Выберите ${label}.`);
  return value;
}
