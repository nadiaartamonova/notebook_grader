import { text } from './validation.js';
export function studentInput(p) {
  return {
    name: text(p.name, 'Имя студента', 100),
    number: text(p.number ?? '', 'Учебный номер', 50, true),
  };
}
