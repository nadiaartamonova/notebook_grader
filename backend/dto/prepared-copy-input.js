import { UserError } from '../errors.js';
// Проверка отредактированной преподавателем копии: корректный JSON, не больше 8 МБ,
// сохранены идентификатор проверки, раздел задания и список ячеек.
export function parsePreparedCopy(body, requestId) {
  if (typeof body !== 'string' || !body.trim() || Buffer.byteLength(body) > 8 * 1024 * 1024)
    throw new UserError('Подготовленный текст пуст или превышает 8 МБ.');
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new UserError(
      'Сохраните корректный JSON: проверьте кавычки и запятые после редактирования.',
    );
  }
  if (
    !parsed ||
    parsed.requestId !== requestId ||
    !Array.isArray(parsed.cells) ||
    !parsed.assignment
  )
    throw new UserError('Не удаляйте идентификатор проверки, раздел задания и список ячеек.');
  return parsed;
}
