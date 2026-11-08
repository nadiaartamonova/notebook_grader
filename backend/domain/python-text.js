// Лексический разбор без исполнения Python. Меняем только текстовые участки,
// сохраняя кавычки, префиксы и выражения f-строк в исходном виде.
export function mapPythonText(source, transform) {
  function stringAt(index) {
    const match = source.slice(index).match(/^(?:(?:rf|fr|rb|br|r|b|f|u))?("""|'''|"|')/i);
    if (!match) return null;
    const delimiter = match[1];
    return {
      start: index + match[0].length,
      delimiter,
      formatted: /f/i.test(match[0].slice(0, -delimiter.length)),
    };
  }
  function expressionEnd(start) {
    let depth = 1,
      i = start;
    while (i < source.length) {
      const str = stringAt(i);
      if (str) {
        i = scanString(str, false).end;
        continue;
      }
      if (source[i] === '#') {
        const end = source.indexOf('\n', i);
        i = end < 0 ? source.length : end;
        continue;
      }
      if (source[i] === '{') depth++;
      if (source[i] === '}' && --depth === 0) return i + 1;
      i++;
    }
    return i;
  }
  function scanString(str, change) {
    let i = str.start,
      chunk = i,
      text = '';
    const append = (end) => {
      text += change ? transform(source.slice(chunk, end)) : source.slice(chunk, end);
    };
    while (i < source.length) {
      if (source[i] === '\\') {
        i = Math.min(i + 2, source.length);
        continue;
      }
      if (source.startsWith(str.delimiter, i)) {
        append(i);
        return { text: text + str.delimiter, end: i + str.delimiter.length };
      }
      if (str.formatted && source[i] === '{') {
        if (source[i + 1] === '{') {
          i += 2;
          continue;
        }
        append(i);
        const end = expressionEnd(i + 1);
        text += source.slice(i, end);
        i = end;
        chunk = i;
        continue;
      }
      i++;
    }
    append(i);
    return { text, end: i };
  }
  let result = '',
    i = 0;
  while (i < source.length) {
    if (source[i] === '#') {
      let end = source.indexOf('\n', i);
      if (end < 0) end = source.length;
      result += '#' + transform(source.slice(i + 1, end));
      i = end;
      continue;
    }
    const str = stringAt(i);
    if (
      str &&
      (source[i] === '"' || source[i] === "'" || i === 0 || !/[\p{L}\p{N}_]/u.test(source[i - 1]))
    ) {
      result += source.slice(i, str.start);
      const parsed = scanString(str, true);
      result += parsed.text;
      i = parsed.end;
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}
