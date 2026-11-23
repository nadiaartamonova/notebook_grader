import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../backend/store.js';
import { defaultSettings, checkSettings } from '../backend/checks/settings.js';
import {
  filenameCheck,
  firstCellCheck,
  identityCheck,
  tasksCheck,
  aiFormCheck,
  syntaxCheck,
  runChecks,
} from '../backend/checks/index.js';
const md = (source) => ({ cell_type: 'markdown', source }),
  nb = (...cells) => ({ nbformat: 4, cells });
const settings = defaultSettings();
test('filename: literal template, Latin diacritics, no whitespace or regex injection', () => {
  const opts = { ...settings, filenamePattern: 'Task1_{Имя}.ipynb' };
  for (const filename of ['Task1_KaarelMägi.ipynb', 'Task1_Žõü.ipynb', 'Task1_Ma\u0308gi.ipynb'])
    assert.equal(filenameCheck(nb(), { ...opts, filename })[0].status, 'passed');
  for (const filename of [
    'Task1_Kaarel Magi.ipynb',
    'Task1_Иван.ipynb',
    'Task1_.ipynb',
    'Task1_MaxXipynb',
  ])
    assert.equal(filenameCheck(nb(), { ...opts, filename })[0].status, 'failed');
  assert.equal(filenameCheck(nb(), settings)[0].status, 'skipped');
  assert.equal(
    filenameCheck(nb(), { ...settings, filenamePattern: 'a[1].ipynb', filename: 'a1.ipynb' })[0]
      .status,
    'failed',
  );
});
test('first cell: empty, code, wrong heading and valid markdown', () => {
  for (const book of [nb(), nb({ cell_type: 'code', source: '# title' }), nb(md('## title'))])
    assert.equal(firstCellCheck(book)[0].status, 'failed');
  assert.equal(firstCellCheck(nb(md('# title')))[0].status, 'passed');
});
test('identity: two cells, date formats and validity, no names in messages', () => {
  for (const date of ['5.3.2026', '05.03.2026', '2026-03-05', '29.2.2024']) {
    const results = identityCheck(nb(md('# Title'), md('Nimi: Kaarel Mägi\n' + date)));
    assert.ok(results.every((r) => r.status === 'passed' && r.cell === 2));
    assert.ok(!JSON.stringify(results).includes('Kaarel'));
  }
  for (const date of ['03/05/2026', '31.2.2026', '2026-13-01', '29.2.2025'])
    assert.equal(identityCheck(nb(md('Kaarel Mägi\n' + date)))[1].status, 'failed');
  assert.ok(identityCheck(nb()).every((r) => r.status === 'failed'));
  assert.equal(identityCheck(nb(md('# Kaarel Mägi\n5.3.2026')))[0].status, 'failed');
  assert.ok(
    identityCheck(nb(md(''), md(''), md('Kaarel Mägi\n5.3.2026'))).every(
      (r) => r.status === 'failed',
    ),
  );
});
test('task headings require count and markdown descriptions', () => {
  assert.ok(
    tasksCheck(nb(md('## One\nDescription\n## Two\nDescription')), {
      ...settings,
      taskCount: 2,
    }).every((r) => r.status === 'passed'),
  );
  assert.ok(
    tasksCheck(nb(md('## One'), { cell_type: 'code', source: 'print(1)' }), settings).some(
      (r) => r.status === 'failed' && r.cell === 1,
    ),
  );
  assert.equal(tasksCheck(nb(md('### One\nText')), settings)[0].status, 'failed');
  assert.equal(tasksCheck(nb(), settings)[0].status, 'failed');
});
test('AI form: separate detection, blank subquestions, answered separators, tail and custom keywords', () => {
  const form =
    '### AI kasutamise vorm\n1. Tools?\nTool\n____\n2. Examples?\na) ____\nb) ____\nc) ____\n8. Why?\n____\n____';
  const results = aiFormCheck(nb(md(form)), settings);
  assert.equal(results[0].status, 'passed');
  assert.deepEqual(
    results.slice(1).map((r) => r.message),
    [
      'Не заполнен пункт 2a.',
      'Не заполнен пункт 2b.',
      'Не заполнен пункт 2c.',
      'Не заполнен пункт 8.',
    ],
  );
  assert.equal(aiFormCheck(nb(), settings)[0].status, 'failed');
  assert.equal(
    aiFormCheck(nb(md(form), ...Array.from({ length: 5 }, () => md(''))), settings)[0].status,
    'failed',
  );
  assert.ok(
    aiFormCheck(nb(md('CUSTOM\n1. Question\nAnswer\n____')), {
      ...settings,
      aiKeywords: 'custom',
    }).every((r) => r.status === 'passed'),
  );
});
test('skipped Python and settings validation', () => {
  assert.equal(syntaxCheck()[0].status, 'skipped');
  assert.equal(
    runChecks(nb(), { ...settings, enabled: { ...settings.enabled, firstCell: false } }).find(
      (r) => r.check === 'firstCell',
    ).status,
    'skipped',
  );
  for (const input of [
    { taskCount: 0 },
    { taskCount: 1.5 },
    { enabled: { firstCell: 'yes' } },
    { filenamePattern: '{Unknown}' },
    { aiKeywords: '' },
  ])
    assert.throws(() => checkSettings(input));
});
// Настоящий ноутбук в репозиторий не входит. Путь задаётся переменной окружения
// PRACTICUM_REAL_NOTEBOOK; без неё тест пропускается.
const realFile = process.env.PRACTICUM_REAL_NOTEBOOK;
test('read-only real notebook fixture', { skip: !realFile || !existsSync(realFile) }, () => {
  const results = runChecks(JSON.parse(readFileSync(realFile, 'utf8')), settings);
  assert.equal(results.find((r) => r.check === 'firstCell').status, 'failed');
  assert.ok(
    results
      .filter((r) => r.check === 'identity')
      .every((r) => r.status === 'passed' && r.cell === 2),
  );
  assert.equal(results.find((r) => r.check === 'aiForm').status, 'passed');
  for (const item of ['2a', '2b', '2c', '8'])
    assert.ok(results.some((r) => r.message === `Не заполнен пункт ${item}.`));
});
async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'practicum-formal-')),
    s = new Store(directory);
  t.after(() => {
    s.close();
    assert.ok(directory.startsWith(join(tmpdir(), 'practicum-formal-')));
    rmSync(directory, { recursive: true, force: true });
  });
  const profile = await s.dispatch('createProfile', {
      name: 'Teacher',
      password: 'x',
      passwordRepeat: 'x',
    }),
    p = { profileId: profile.active };
  const values = { name: 'Python', group: 'A', year: 2026, semester: 'Осень', mode: 'Дневное' };
  p.courseId = s.dispatch('createCourse', { ...p, ...values }).courses[0].id;
  const student = s.dispatch('addStudent', { ...p, name: 'Sample Student', number: '1' }).courses[0]
    .students[0];
  const assignment = s.dispatch('saveAssignment', {
    ...p,
    name: 'Task',
    criteria: [{ name: 'Logic', points: 5 }],
    formalChecks: { ...settings, filenamePattern: 'Task_{Имя}.ipynb', taskCount: 3 },
  }).courses[0].assignments[0];
  p.assignmentId = assignment.id;
  p.importId = s.dispatch('importNotebook', {
    ...p,
    studentId: student.id,
    name: 'Task_Sample.ipynb',
    base64: Buffer.from(JSON.stringify(nb(md('# Title\nSample Student\n1.1.2026')))).toString(
      'base64',
    ),
  }).courses[0].assignments[0].works[0].importId;
  return { s, p, assignment, values };
}
test('persist runs, pinned settings, copy course, immutable and transactional history', async (t) => {
  const { s, p, assignment, values } = await fixture(t);
  let updated = s.dispatch('saveAssignment', {
    ...p,
    id: assignment.id,
    expectedRevision: assignment.revision_id,
    name: 'Task edited',
    criteria: [{ name: 'Logic', points: 5 }],
  }).courses[0].assignments[0];
  assert.deepEqual(updated.formalChecks, assignment.formalChecks);
  updated = s.dispatch('saveAssignment', {
    ...p,
    id: assignment.id,
    expectedRevision: updated.revision_id,
    name: 'Task edited',
    criteria: [{ name: 'Logic', points: 5 }],
    formalChecks: { ...settings, taskCount: 9 },
  }).courses[0].assignments[0];
  const state = s.dispatch('copyCourse', { ...p, ...values, sourceId: p.courseId, name: 'Copy' });
  assert.deepEqual(
    state.courses.find((c) => c.id !== p.courseId).assignments[0].formalChecks,
    updated.formalChecks,
  );
  const first = s.dispatch('runFormalChecks', p).runs[0];
  assert.equal(first.assignmentRevisionId, assignment.revision_id);
  assert.ok(first.results.some((r) => r.message.includes('не меньше 3')));
  const second = s.dispatch('runFormalChecks', p).runs;
  assert.equal(second.length, 2);
  assert.notEqual(second[0].id, first.id);
  assert.throws(() => s.run('DELETE FROM formal_check_runs'), /Immutable/);
  assert.throws(() => s.run("UPDATE formal_check_runs SET results_json='[]'"), /Immutable/);
  assert.throws(() => s.run("UPDATE formal_check_settings SET settings_json='{}'"), /Immutable/);
  s.db.exec(
    "CREATE TRIGGER fail_formal BEFORE INSERT ON formal_check_runs BEGIN SELECT RAISE(ABORT,'test rollback'); END;",
  );
  assert.throws(() => s.dispatch('runFormalChecks', p), /rollback/);
  assert.equal(s.dispatch('getFormalChecks', p).runs.length, 2);
});
test('ownership, author reassignment and soft deletion protect formal checks', async (t) => {
  const { s, p } = await fixture(t);
  s.dispatch('runFormalChecks', p);
  assert.throws(() => s.dispatch('runFormalChecks', { ...p, profileId: 'other' }));
  assert.throws(() => s.dispatch('getFormalChecks', { ...p, courseId: 'other' }));
  assert.throws(() => s.dispatch('getFormalChecks', { ...p, assignmentId: 'other' }));
  const event = s.snapshot().courses[0].assignments[0].works[0].authorEventId;
  const other = s
    .dispatch('addStudent', { ...p, name: 'Other Student', number: '2' })
    .courses[0].students.find((x) => x.number === '2');
  s.dispatch('changeSubmissionAuthor', { ...p, studentId: other.id, expectedAuthorEventId: event });
  assert.equal(s.dispatch('getFormalChecks', p).runs.length, 0);
  assert.equal(s.get('SELECT COUNT(*) AS n FROM formal_check_runs').n, 1);
  s.dispatch('deleteSubmission', { ...p, confirmDelete: true });
  for (const command of ['runFormalChecks', 'getFormalChecks'])
    assert.throws(() => s.dispatch(command, p));
});

test('unassigned work is rejected and invalid settings roll back a new revision', async (t) => {
  const { s, p, assignment } = await fixture(t);
  const state = s.dispatch('importNotebook', {
    ...p,
    name: 'Unassigned.ipynb',
    base64: Buffer.from(JSON.stringify(nb())).toString('base64'),
  });
  const work = state.courses[0].assignments[0].works.find((w) => !w.studentId);
  for (const command of ['getFormalChecks', 'runFormalChecks'])
    assert.throws(() => s.dispatch(command, { ...p, importId: work.importId }), /автора/);
  assert.throws(
    () =>
      s.dispatch('saveAssignment', {
        ...p,
        id: assignment.id,
        expectedRevision: assignment.revision_id,
        name: 'Invalid',
        criteria: [{ name: 'Logic', points: 5 }],
        formalChecks: { taskCount: -1 },
      }),
    /Число задач/,
  );
  assert.equal(s.snapshot().courses[0].assignments[0].revision_id, assignment.revision_id);
});
