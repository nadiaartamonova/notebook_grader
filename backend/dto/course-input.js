import { UserError } from '../errors.js';
import { text, choice } from './validation.js';
export function courseInput(p) {
  const year = Number(p.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw new UserError('Год должен быть от 2000 до 2100.');
  return {
    name: text(p.name, 'Название дисциплины', 100),
    group: text(p.group, 'Группа и курс', 100),
    year,
    semester: choice(p.semester, ['Весна', 'Осень'], 'семестр'),
    mode: choice(p.mode, ['Дневное', 'Сессионное'], 'форму обучения'),
  };
}
