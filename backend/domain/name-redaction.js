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
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${tokens.map(escape).join('|')})(?![\\p{L}\\p{N}_])`,
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
