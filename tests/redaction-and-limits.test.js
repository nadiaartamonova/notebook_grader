import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparePayload } from '../backend/domain/notebooks.js';
import { pastedOverflow } from '../src/utils/text-limit.js';
const assignment = { name: 'Задание', description: '', additional: '', rules: '', criteria: [] };
function prepare(name, source, type = 'markdown', filename = 'Task1.ipynb', task = assignment) {
  return preparePayload(
    { cells: [{ cell_type: type, source }] },
    { name, student_number: '' },
    task,
    'request',
    filename,
  );
}
test('names match diacritics in both directions and decomposed Unicode', () => {
  for (const [name, source] of [
    ['Magi', 'Mägi'],
    ['Mägi', 'Magi'],
    ['ÕÖÜŠŽ', 'Oousz'],
    ['Oousz', 'ÕÖÜŠŽ'],
    ['Magi', 'Ma\u0308gi'],
  ]) {
    const result = prepare(name, source);
    assert.equal(JSON.parse(result.body).cells[0].source, '[СТУДЕНТ]');
    assert.equal(result.findings.names, 1);
  }
});
test('filename supplies CamelCase and underscore name parts without generic task tokens', () => {
  for (const filename of ['Task1_KaarelMagi.ipynb', 'Task1_Kaarel_Mägi.ipynb']) {
    const result = prepare('Other Person', 'Kaarel Mägi Task task', 'markdown', filename);
    assert.equal(JSON.parse(result.body).cells[0].source, '[СТУДЕНТ] [СТУДЕНТ] Task task');
    assert.equal(result.findings.names, 2);
  }
});
test('code preserves expressions and redacts comments without case sensitivity', () => {
  const code = prepare('Max', 'max([1,2]) # Max MAX maximum', 'code');
  assert.equal(JSON.parse(code.body).cells[0].source, 'max([1,2]) # [СТУДЕНТ] [СТУДЕНТ] maximum');
  const markdown = prepare('Max', 'Max max MAX maximum');
  assert.equal(JSON.parse(markdown.body).cells[0].source, '[СТУДЕНТ] [СТУДЕНТ] [СТУДЕНТ] maximum');
  assert.equal(prepare('Magi', 'Mägi mägi', 'code').findings.names, 0);
});
test('zero name matches are flagged even when the assignment contains the name', () => {
  const result = prepare('Max', 'max([1,2])', 'code', 'Task1.ipynb', {
    ...assignment,
    name: 'Max',
  });
  assert.equal(result.findings.names, 0);
  assert.equal(result.findings.nameNotFound, true);
  assert.equal(prepare('Max', 'Max').findings.nameNotFound, false);
});
test('paste overflow accounts for replacement selection and UTF-16 browser limits', () => {
  assert.equal(pastedOverflow('abc', 3, 3, 'x'.repeat(148), 150), 1);
  assert.equal(pastedOverflow('abc', 0, 3, 'x'.repeat(150), 150), 0);
  assert.equal(pastedOverflow('abc', 1, 2, 'x'.repeat(150), 150), 2);
  assert.equal(pastedOverflow('', 0, 0, '😀', 1), 1);
  assert.equal(pastedOverflow('abc', 0, 3, '', 150), 0);
});
