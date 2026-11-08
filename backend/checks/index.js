export const source = (cell) => (Array.isArray(cell.source) ? cell.source.join('') : cell.source);
const result = (check, status, message, cell = null) => ({ check, status, message, cell });
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Проверки читают только source. Выводы, метаданные и код не исполняются.
export function filenameCheck(notebook, settings) {
  if (!settings.filenamePattern)
    return [result('filename', 'skipped', 'Шаблон имени файла не задан.')];
  const pattern = settings.filenamePattern
    .split('{Имя}')
    .map(escape)
    .join('(?:\\p{Script=Latin}\\p{M}*)+');
  const valid = new RegExp('^' + pattern + '$', 'u').test(
    (settings.filename ?? '').normalize('NFC'),
  );
  return [
    result(
      'filename',
      valid ? 'passed' : 'failed',
      valid ? 'Имя файла соответствует шаблону.' : 'Имя файла не соответствует шаблону.',
    ),
  ];
}
export function firstCellCheck(notebook) {
  const c = notebook.cells[0];
  const valid = c?.cell_type === 'markdown' && /^\s{0,3}#\s+\S/m.test(source(c));
  return [
    result(
      'firstCell',
      valid ? 'passed' : 'failed',
      valid
        ? 'Первая ячейка содержит заголовок.'
        : 'Первая ячейка должна быть markdown с заголовком #.',
      c ? 1 : null,
    ),
  ];
}
function hasDate(text) {
  const dates = [
    ...text.matchAll(/(?<!\d)(?:(\d{1,2})\.(\d{1,2})\.(\d{4})|(\d{4})-(\d{2})-(\d{2}))(?!\d)/g),
  ];
  return dates.some((m) => {
    const [y, mo, d] = m[1] ? [+m[3], +m[2], +m[1]] : [+m[4], +m[5], +m[6]];
    const date = new Date(0);
    date.setUTCFullYear(y, mo - 1, d);
    return (
      y > 0 &&
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === mo - 1 &&
      date.getUTCDate() === d
    );
  });
}
export function identityCheck(notebook) {
  const cells = notebook.cells.slice(0, 2);
  // Это формальная эвристика, а не установление личности: заголовок не считается именем.
  const name = cells.findIndex((c) =>
    source(c)
      .split(/\r?\n/)
      .some((line) => {
        const clean = line
          .trim()
          .replace(/\*\*/g, '')
          .replace(/^(?:nimi|name|имя|автор|autor|student)\s*:\s*/iu, '');
        return /^(?:(?:nimi|name|имя|автор|autor|student)\s*:\s*)?\p{Lu}[\p{L}\p{M}'’-]+(?:[ \t]+\p{Lu}[\p{L}\p{M}'’-]+)+\s*$/u.test(
          clean,
        );
      }),
  );
  const date = cells.findIndex((c) => hasDate(source(c)));
  return [
    result(
      'identity',
      name >= 0 ? 'passed' : 'failed',
      name >= 0
        ? 'В начале найдена строка, похожая на имя.'
        : 'В первых двух ячейках не найдена отдельная строка с именем.',
      name >= 0 ? name + 1 : null,
    ),
    result(
      'identity',
      date >= 0 ? 'passed' : 'failed',
      date >= 0
        ? 'В начале найдена дата.'
        : 'В первых двух ячейках нет корректной даты в поддерживаемом формате.',
      date >= 0 ? date + 1 : null,
    ),
  ];
}
export function tasksCheck(notebook, settings) {
  const sections = [];
  let active = null;
  notebook.cells.forEach((c, i) => {
    if (c.cell_type !== 'markdown') return;
    for (const line of source(c).split(/\r?\n/)) {
      if (/^\s{0,3}##\s+\S/.test(line)) {
        active = { cell: i + 1, description: false };
        sections.push(active);
      } else if (/^\s{0,3}#{1,6}\s/.test(line)) active = null;
      else if (active && line.trim()) active.description = true;
    }
  });
  return [
    result(
      'tasks',
      sections.length >= settings.taskCount ? 'passed' : 'failed',
      `Заголовков задач: ${sections.length}; требуется не меньше ${settings.taskCount}.`,
    ),
    ...sections.map((s) =>
      result(
        'tasks',
        s.description ? 'passed' : 'failed',
        s.description ? 'После заголовка есть описание.' : 'После заголовка задачи нет описания.',
        s.cell,
      ),
    ),
  ];
}
export function aiFormCheck(notebook, settings) {
  // «Последние ячейки» определены явно: последние пять. Форма может занимать несколько ячеек.
  const start = Math.max(0, notebook.cells.length - 5);
  const index = notebook.cells.findIndex(
    (c, i) =>
      i >= start &&
      c.cell_type === 'markdown' &&
      source(c).toLocaleLowerCase().includes(settings.aiKeywords.toLocaleLowerCase()),
  );
  if (index < 0)
    return [
      result('aiForm', 'failed', 'Формы нет; если ИИ не использовался, преподаватель решает сам.'),
    ];
  const results = [result('aiForm', 'passed', 'Форма об использовании ИИ найдена.', index + 1)];
  let question = '',
    answer = false,
    blanks = false,
    cellNumber = index + 1;
  const flush = () => {
    if (question && blanks && !answer)
      results.push(result('aiForm', 'failed', `Не заполнен пункт ${question}.`, cellNumber));
  };
  for (let i = index; i < notebook.cells.length; i++) {
    if (notebook.cells[i].cell_type !== 'markdown') continue;
    for (const line of source(notebook.cells[i]).split(/\r?\n/)) {
      const number = line.match(/^\s*(\d{1,3})[.)]\s*/);
      const sub = line.match(/^\s*([a-z])[)]\s*/i);
      let body = line;
      if (number || sub) {
        flush();
        question = number ? number[1] : question.replace(/[a-z]$/i, '') + sub[1].toLowerCase();
        answer = false;
        blanks = false;
        cellNumber = i + 1;
        body = sub ? line.slice(sub[0].length) : '';
      }
      if (!question) continue;
      if (/_{4,}/.test(body)) {
        blanks = true;
        if (body.replace(/_/g, '').trim()) answer = true;
      } else if (body.trim() && !/^\s*\(/.test(body)) answer = true;
    }
  }
  flush();
  if (results.length === 1)
    results.push(
      result('aiForm', 'passed', 'Незаполненных строк из подчёркиваний не найдено.', index + 1),
    );
  return results;
}
export function syntaxCheck() {
  return [result('syntax', 'skipped', 'Синтаксис Python: не проверяется.')];
}
export function runChecks(notebook, settings) {
  const checks = {
    filename: filenameCheck,
    firstCell: firstCellCheck,
    identity: identityCheck,
    tasks: tasksCheck,
    aiForm: aiFormCheck,
    syntax: syntaxCheck,
  };
  return Object.entries(checks).flatMap(([key, fn]) =>
    settings.enabled[key]
      ? fn(notebook, settings)
      : [result(key, 'skipped', 'Проверка выключена в задании.')],
  );
}
