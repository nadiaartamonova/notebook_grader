const fold = (value) => value.normalize('NFD').replace(/\p{M}/gu, '');
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const generic = new Set([
  'task',
  'assignment',
  'notebook',
  'lab',
  'homework',
  'solution',
  'work',
  'submission',
  'ipynb',
  'задание',
  'работа',
]);

export function nameTokens(name, filename = '') {
  const chunks = filename.replace(/\.ipynb$/i, '').split(/[_\s.\-]+/u);
  const filenameTokens = chunks
    .filter((chunk) => !/\d/u.test(chunk))
    .flatMap((chunk) => [
      chunk,
      ...chunk
        .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
        .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
        .split(' '),
    ])
    .filter((token) => !generic.has(fold(token).toLowerCase()));
  return [
    ...new Set(
      [name, ...name.split(/\s+/u), ...filenameTokens]
        .map(fold)
        .filter((token) => token.length >= 2),
    ),
  ].sort((a, b) => b.length - a.length);
}

// Ищем в нормализованной строке, а заменяем диапазоны оригинала, включая составные диакритики.
export function redactNames(source, tokens, caseSensitive = false) {
  if (!tokens.length) return { text: source, count: 0 };
  let normalized = '',
    offset = 0;
  const starts = [],
    ends = [];
  for (const character of source) {
    const folded = fold(character);
    if (!folded && ends.length) ends[ends.length - 1] = offset + character.length;
    for (let i = 0; i < folded.length; i++) {
      starts.push(offset);
      ends.push(offset + character.length);
    }
    normalized += folded;
    offset += character.length;
  }
  const parts = [...new Set(tokens.filter((t) => /^\p{L}+$/u.test(t)).map((t) => t.toLowerCase()))];
  const pairs = parts.flatMap((a) =>
    parts.filter((b) => a !== b).map((b) => escape(a) + '[_.-]?' + escape(b)),
  );
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${[...pairs, ...tokens.map(escape)].join('|')})(?![\\p{L}\\p{N}_])`,
    caseSensitive ? 'gu' : 'giu',
  );
  let result = '',
    cursor = 0,
    count = 0;
  for (const match of normalized.matchAll(pattern)) {
    const start = starts[match.index],
      end = ends[match.index + match[0].length - 1];
    result += source.slice(cursor, start) + '[СТУДЕНТ]';
    cursor = end;
    count++;
  }
  return { text: result + source.slice(cursor), count };
}

// Ограниченное расстояние Левенштейна; длинные посторонние слова отсекаются до расчёта.
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next[j + 1] = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1));
    if (Math.min(...next) > 2) return 3;
    row = next;
  }
  return row[b.length];
}
export function redactTextNames(source, tokens) {
  const exact = redactNames(source, tokens),
    suspicious = [];
  const parts = [
    ...new Set(tokens.filter((t) => /^\p{L}+$/u.test(t)).map((t) => fold(t).toLowerCase())),
  ];
  let typos = 0;
  const text = exact.text.replace(
    /(?<![\p{L}\p{N}_\[])[\p{L}\p{M}]+(?![\p{L}\p{N}_\]])/gu,
    (word) => {
      const folded = fold(word).toLowerCase();
      if (folded.length < 3 || ['студент', 'пользователь', 'ник'].includes(folded)) return word;
      const matches = parts.map((part) => ({ part, d: distance(folded, part) }));
      if (matches.some((m) => m.part.length >= 5 && m.d === 1)) {
        typos++;
        return '[СТУДЕНТ]';
      }
      if (
        matches.some(
          (m) =>
            // Расстояние 2 только для длинных частей имени: для коротких (Magi, Ott, Tamm) под него
            // попадает слишком много обычных слов (järgi, ole, len), и список «Проверьте вручную» теряет смысл.
            (m.d === 2 && m.part.length >= 6) ||
            (m.part.length < 5 && m.d === 1) ||
            (m.part.length >= 3 &&
              folded.endsWith(m.part) &&
              folded.length > m.part.length &&
              folded.length <= m.part.length + 4),
        )
      )
        suspicious.push({ text: word, reason: 'Возможная опечатка в имени' });
      return word;
    },
  );
  return { text, count: exact.count + typos, typos, suspicious };
}
