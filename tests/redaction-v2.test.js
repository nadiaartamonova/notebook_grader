import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { preparePayload, readNotebook } from '../backend/domain/notebooks.js';
import { mapPythonText } from '../backend/domain/python-text.js';
const assignment = { name: 'Task', description: '', additional: '', rules: '', criteria: [] };
function prepare(source, type = 'markdown', name = 'Kaarel Mägi') {
  const result = preparePayload(
    { cells: [{ cell_type: type, source }] },
    { name, student_number: '' },
    assignment,
    'test',
  );
  return { ...result, text: JSON.parse(result.body).cells[0].source };
}
test('v2: joined names in either order and diacritics are replaced', () => {
  for (const word of [
    'kaarel_magi',
    'magi.kaarel',
    'KaarelMagi',
    'MagiKaarel',
    'KAAREL-MÄGI',
    'mägi_kaarel',
  ])
    assert.equal(prepare(word).text, '[СТУДЕНТ]');
});
test('v2: one edit of long name is replaced; short typos and distance two are manual', () => {
  assert.equal(prepare('Karel').text, '[СТУДЕНТ]');
  for (const word of ['Mäggi', 'Krel', 'Kremägi']) {
    const result = prepare(word);
    assert.equal(result.text, word);
    assert.ok(result.findings.suspicious.some((s) => s.text === word && s.cell === 1));
  }
  assert.equal(prepare('Karel').findings.typos, 1);
  for (const source of ['# Karel', 'print("Karel")'])
    assert.ok(prepare(source, 'code').text.includes('[СТУДЕНТ]'));
  assert.equal(prepare('Karel = 1', 'code').text, 'Karel = 1');
});
test('v2: author labels replace arbitrary spelling, preserving comments and quotes', () => {
  for (const label of ['Nimi', 'Name', 'Имя', 'Autor', 'Author', 'Õpilane', 'Student'])
    assert.equal(prepare(`${label}: Karel Megi`).text, `${label}: [СТУДЕНТ]`);
  assert.equal(prepare('# autor: kaarel', 'code').text, '# autor: [СТУДЕНТ]');
  assert.equal(prepare('print("Nimi: Karel Megi")', 'code').text, 'print("Nimi: [СТУДЕНТ]")');
  assert.equal(prepare('Nimi:\nKirjeldus').text, 'Nimi:\nKirjeldus');
});
test('v2: home paths and hosting usernames have independent counters', () => {
  for (const path of [
    String.raw`C:\Users\someone\file`,
    'C:/Users/someone/file',
    '/home/someone/file',
    '/Users/someone/file',
    String.raw`C:\\Users\\someone\\file`,
  ]) {
    const result = prepare(path);
    assert.ok(!result.text.includes('someone'));
    assert.ok(result.text.includes('[ПОЛЬЗОВАТЕЛЬ]'));
    assert.equal(result.findings.paths, 1);
  }
  for (const host of ['github.com', 'gitlab.com', 'bitbucket.org']) {
    const r = prepare(`https://${host}/someone/repo`);
    assert.equal(r.text, `https://${host}/[НИК]/repo`);
    assert.equal(r.findings.handles, 1);
  }
});
test('v2: expressions and f-string expressions stay byte-for-byte unchanged', () => {
  for (const source of [
    'max(a)',
    'max_len = max(a)',
    'Max = max(a)',
    'f"{max(a)}"',
    'f"{max({\'Max\': a})}"',
    'f"{\'Max Tamm\'}"',
    'f"{value:{max(a)}}"',
  ])
    assert.equal(prepare(source, 'code', 'Max Tamm').text, source);
  assert.equal(
    prepare('print("Max Tamm") # Max Tamm', 'code', 'Max Tamm').text,
    'print("[СТУДЕНТ]") # [СТУДЕНТ]',
  );
  assert.equal(
    prepare('f"Max {max(a)} TAMM"', 'code', 'Max Tamm').text,
    'f"[СТУДЕНТ] {max(a)} [СТУДЕНТ]"',
  );
  assert.equal(prepare('f"{{Max}} {max(a)}"', 'code', 'Max').text, 'f"{{[СТУДЕНТ]}} {max(a)}"');
});
test('v2: quoted hash, escapes, multiline literals and prefixes', () => {
  for (const prefix of ['', 'r', 'b', 'f', 'u', 'rf', 'fr', 'br', 'rb', 'RF'])
    for (const quote of ['"', "'", '"""', "'''"]) {
      const input = `${prefix}${quote}MÄGI KAAREL${quote}`;
      assert.ok(!prepare(input, 'code').text.includes('KAAREL'));
    }
  const source = String.raw`print("# Max \" Max") # Max`;
  assert.equal(
    prepare(source, 'code', 'Max').text,
    String.raw`print("# [СТУДЕНТ] \" [СТУДЕНТ]") # [СТУДЕНТ]`,
  );
  assert.equal(
    prepare('"""Max\nmax\n"""\nmax(a)', 'code', 'Max').text,
    '"""[СТУДЕНТ]\n[СТУДЕНТ]\n"""\nmax(a)',
  );
  const seen = [];
  mapPythonText('"# inside" # outside', (text) => {
    seen.push(text);
    return text;
  });
  assert.deepEqual(seen, ['# inside', ' outside']);
});
test('v2: ordinary identifiers and Estonian words are not replaced; unknown pairs flagged', () => {
  const ordinary = 'magic_number = max_len\n# See on tavaline tekst ja funktsioon kasutab andmeid';
  assert.equal(prepare(ordinary, 'code', 'Magi').text, ordinary);
  assert.equal(
    prepare('See on tavaline tekst ja funktsioon kasutab andmeid').text,
    'See on tavaline tekst ja funktsioon kasutab andmeid',
  );
  const result = prepare('# Alice Smith\nprint("Jane Doe")', 'code');
  assert.equal(result.text, '# Alice Smith\nprint("Jane Doe")');
  assert.ok(result.findings.suspicious.some((s) => s.text === 'Alice Smith'));
  assert.ok(result.findings.suspicious.some((s) => s.text === 'Jane Doe'));
});
const directory = new URL('../../testdata/', import.meta.url);
test(
  'v2: real notebooks read only, original bytes unchanged and comments retained',
  { skip: !existsSync(directory) },
  () => {
    const files = readdirSync(directory).filter((f) => f.endsWith('.ipynb'));
    for (const file of files) {
      const path = new URL(file, directory),
        before = readFileSync(path),
        book = readNotebook(before);
      const output = JSON.parse(
        preparePayload(book, { name: 'Kaarel Mägi', student_number: '' }, assignment, 'test', file)
          .body,
      );
      for (const cell of output.cells.filter((c) => c.type === 'code')) {
        const original = book.cells[cell.number - 1],
          text = Array.isArray(original.source) ? original.source.join('') : original.source;
        // Удаляем только изменяемые фрагменты: оставшийся код и разделители должны совпасть.
        assert.equal(
          mapPythonText(cell.source, () => ''),
          mapPythonText(text, () => ''),
        );
      }
      assert.deepEqual(readFileSync(path), before);
    }
  },
);
