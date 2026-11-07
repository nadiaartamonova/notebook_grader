import { UserError } from '../errors.js';
export function passwordPolicy(mode = 'test') {
  if (!['test', 'strict'].includes(mode)) throw new Error('Неизвестная политика паролей.');
  return { mode, minLength: mode === 'strict' ? 8 : 1, requiresSpecial: mode === 'strict' };
}
export function passwordProblems(password, mode) {
  const policy = passwordPolicy(mode),
    problems = [];
  if (typeof password !== 'string') return ['Введите пароль.'];
  if ([...password].length < policy.minLength)
    problems.push(`Не меньше ${policy.minLength} символов.`);
  if (policy.requiresSpecial && !/[^\p{L}\p{N}]/u.test(password))
    problems.push('Нужен хотя бы один спецсимвол (не буква и не цифра).');
  if (Buffer.byteLength(password) > 1024) problems.push('Пароль превышает 1024 байта.');
  return problems;
}
export function validateNewPassword(p, mode) {
  const problems = passwordProblems(p.password, mode);
  if (p.password !== p.passwordRepeat) problems.push('Пароли не совпадают.');
  if (problems.length) throw new UserError(problems.join(' '));
}
