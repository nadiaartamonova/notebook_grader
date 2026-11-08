import { UserError } from '../errors.js';
export const checkNames = ['filename', 'firstCell', 'identity', 'tasks', 'aiForm', 'syntax'];
export const defaultSettings = () => ({
  enabled: Object.fromEntries(checkNames.map((k) => [k, true])),
  filenamePattern: '',
  taskCount: 1,
  aiKeywords: 'AI kasutamise vorm',
});
export function checkSettings(value) {
  if (value === undefined) return defaultSettings();
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new UserError('Неверные настройки проверок.');
  const result = defaultSettings();
  if (value.enabled !== undefined) {
    if (!value.enabled || typeof value.enabled !== 'object' || Array.isArray(value.enabled))
      throw new UserError('Неверные переключатели проверок.');
    for (const key of Object.keys(value.enabled)) {
      if (!checkNames.includes(key) || typeof value.enabled[key] !== 'boolean')
        throw new UserError('Неверный переключатель проверки.');
      result.enabled[key] = value.enabled[key];
    }
  }
  for (const key of ['filenamePattern', 'aiKeywords']) {
    const text = value[key] ?? result[key];
    if (typeof text !== 'string' || text.length > 250)
      throw new UserError('Поле настроек проверки: не более 250 символов.');
    result[key] = text.trim();
  }
  if (/[{}]/u.test(result.filenamePattern.replaceAll('{Имя}', '')))
    throw new UserError('В шаблоне разрешён только маркер {Имя}.');
  result.taskCount = value.taskCount ?? 1;
  if (!Number.isInteger(result.taskCount) || result.taskCount < 1 || result.taskCount > 1000)
    throw new UserError('Число задач: целое от 1 до 1000.');
  if (!result.aiKeywords) throw new UserError('Укажите ключевые слова формы ИИ.');
  return result;
}
