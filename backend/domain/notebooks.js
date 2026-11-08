import { nameTokens, redactNames } from './name-redaction.js';
import { UserError } from '../errors.js';

export const MAX_NOTEBOOK_BYTES = 5 * 1024 * 1024;
export function readNotebook(bytes) {
  if (!bytes.length || bytes.length > MAX_NOTEBOOK_BYTES)
    throw new UserError('Размер ноутбука должен быть от 1 байта до 5 МБ.');
  let notebook;
  try {
    notebook = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new UserError('Файл не является корректным ноутбуком UTF-8 JSON.');
  }
  if (notebook?.nbformat !== 4 || !Array.isArray(notebook.cells) || notebook.cells.length > 10000)
    throw new UserError('Нужен ноутбук формата Jupyter 4 с массивом ячеек (не более 10 000).');
  for (const cell of notebook.cells) {
    if (
      !cell ||
      !['code', 'markdown', 'raw'].includes(cell.cell_type) ||
      !(
        typeof cell.source === 'string' ||
        (Array.isArray(cell.source) && cell.source.every((s) => typeof s === 'string'))
      )
    ) {
      throw new UserError('В ноутбуке обнаружена ячейка с неверной структурой.');
    }
  }
  return notebook;
}

const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function preparePayload(notebook, student, assignment, requestId, filename = '') {
  const counts = { names: 0, numbers: 0, emails: 0, phones: 0, images: 0 };
  const tokens = nameTokens(student.name, filename);
  function replace(value, regex, marker, category) {
    return value.replace(regex, () => {
      counts[category]++;
      return marker;
    });
  }
  function sanitize(input, caseSensitive = false) {
    let value = input;
    value = replace(
      value,
      /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}/gi,
      '[ЭЛЕКТРОННАЯ ПОЧТА]',
      'emails',
    );
    const redacted = redactNames(value, tokens, caseSensitive);
    value = redacted.text;
    counts.names += redacted.count;
    if (student.student_number)
      value = replace(
        value,
        new RegExp(`(?<![\\p{L}\\p{N}])${escaped(student.student_number)}(?![\\p{L}\\p{N}])`, 'gu'),
        '[УЧЕБНЫЙ НОМЕР]',
        'numbers',
      );
    value = replace(value, /\+\d(?:[\d ()-]{5,}\d)/g, '[ВОЗМОЖНЫЙ ТЕЛЕФОН]', 'phones');
    value = replace(
      value,
      /!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>|data:image\/[^\s"')>]+/gi,
      '[ИЗОБРАЖЕНИЕ ИСКЛЮЧЕНО]',
      'images',
    );
    return value;
  }
  const cells = notebook.cells.flatMap((cell, index) =>
    cell.cell_type === 'raw'
      ? []
      : [
          {
            number: index + 1,
            type: cell.cell_type,
            source: sanitize(
              Array.isArray(cell.source) ? cell.source.join('') : cell.source,
              cell.cell_type === 'code',
            ),
          },
        ],
  );
  const namesInWork = counts.names;
  const body = {
    requestId,
    assignment: {
      title: sanitize(assignment.name),
      description: sanitize(assignment.description),
      additional: sanitize(assignment.additional),
      rules: sanitize(assignment.rules),
      criteria: assignment.criteria.map((c, i) => ({
        key: `C${i + 1}`,
        name: sanitize(c.name),
        description: sanitize(c.description),
        points: c.points,
      })),
    },
    cells,
  };
  const findings = {
    ...counts,
    names: namesInWork,
    nameNotFound: namesInWork === 0,
    excludedRawCells: notebook.cells.filter((c) => c.cell_type === 'raw').length,
    excludedOutputCells: notebook.cells.filter((c) => c.outputs?.length).length,
    excludedAttachmentCells: notebook.cells.filter(
      (c) => c.attachments && Object.keys(c.attachments).length,
    ).length,
  };
  return { body: JSON.stringify(body, null, 2), findings };
}
