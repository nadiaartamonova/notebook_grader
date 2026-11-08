// Только чтение: исходный текст ноутбука без исполнения и история работы.
import { readNotebook } from '../../domain/notebooks.js';
import { requireImport } from './context.js';

export function readOriginal(store, p) {
  const item = requireImport(store, p);
  const notebook = readNotebook(store.files.readOriginal(item));
  return {
    file: item.original_name,
    cells: notebook.cells.map((c, i) => ({
      number: i + 1,
      type: c.cell_type,
      source: Array.isArray(c.source) ? c.source.join('') : c.source,
    })),
    excluded: 'Выводы, вложения и HTML не исполняются и не отображаются.',
  };
}

export function workHistory(store, p) {
  const item = requireImport(store, p);
  return {
    authors: store.repositories.submissions.authorHistory(item.id),
    copies: store.repositories.submissions.copyHistory(item.id),
  };
}
