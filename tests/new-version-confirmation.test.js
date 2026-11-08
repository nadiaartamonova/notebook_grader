import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../backend/store.js';

const notebook = (text) =>
  Buffer.from(
    JSON.stringify({ nbformat: 4, cells: [{ cell_type: 'markdown', source: text }] }),
  ).toString('base64');

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'practicum-version-'));
  const s = new Store(dir);
  t.after(() => {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const state = await s.dispatch('createProfile', {
    name: 'T',
    password: 'x',
    passwordRepeat: 'x',
  });
  const p = { profileId: state.active };
  p.courseId = s.dispatch('createCourse', {
    ...p,
    name: 'C',
    group: 'A',
    year: 2026,
    semester: 'Осень',
    mode: 'Дневное',
  }).courses[0].id;
  s.dispatch('addStudent', { ...p, name: 'Robert Kask', number: '' });
  s.dispatch('addStudent', { ...p, name: 'Kaarel Mägi', number: '' });
  const students = s.dispatch('state', {}).courses[0].students;
  const robert = students.find((x) => x.name === 'Robert Kask').id;
  const kaarel = students.find((x) => x.name === 'Kaarel Mägi').id;
  p.assignmentId = s.dispatch('saveAssignment', {
    ...p,
    name: 'Task',
    criteria: [{ name: 'L', points: 5 }],
  }).courses[0].assignments[0].id;
  const works = () => s.dispatch('state', {}).courses[0].assignments[0].works;
  const upload = (name, studentId, extra = {}) =>
    s.dispatch('importNotebook', { ...p, name, studentId, base64: notebook(name), ...extra });
  return { s, p, robert, kaarel, works, upload };
}

test('work moved to another student no longer counts as the first student existing work', async (t) => {
  const { s, p, robert, kaarel, works, upload } = await fixture(t);
  // Ошибка преподавателя: работа Kaarel назначена Robert, затем автор исправлен.
  upload('Task1_KaarelMagi.ipynb', robert);
  const wrong = works()[0];
  s.dispatch('changeSubmissionAuthor', {
    ...p,
    importId: wrong.importId,
    studentId: kaarel,
    expectedAuthorEventId: wrong.authorEventId,
  });
  // Настоящая работа Robert загружается без вопроса о новой версии.
  upload('Task1_RobertKask.ipynb', robert);
  const robertWork = works().find((w) => w.file === 'Task1_RobertKask.ipynb');
  assert.equal(robertWork.studentId, robert);
  // Номер сдачи продолжает историю и не используется повторно.
  assert.equal(robertWork.version, 2);
  // Повторная сдача при действующей работе по-прежнему требует подтверждения.
  assert.throws(() => upload('Task1_RobertKask_v2.ipynb', robert), /новой версии/);
  upload('Task1_RobertKask_v2.ipynb', robert, { confirmNewVersion: true });
});

test('deleted work does not require new-version confirmation for the same student', async (t) => {
  const { s, p, robert, works, upload } = await fixture(t);
  upload('first.ipynb', robert);
  s.dispatch('deleteSubmission', { ...p, importId: works()[0].importId, confirmDelete: true });
  upload('second.ipynb', robert);
  assert.equal(works().length, 1);
  assert.equal(works()[0].file, 'second.ipynb');
});

test('assigning an unassigned work asks for confirmation only when the student has a current work', async (t) => {
  const { s, p, robert, kaarel, works, upload } = await fixture(t);
  upload('a.ipynb', null);
  upload('b.ipynb', robert);
  const unassigned = works().find((w) => w.file === 'a.ipynb');
  assert.throws(
    () => s.dispatch('assignSubmission', { ...p, importId: unassigned.importId, studentId: robert }),
    /новой версии/,
  );
  s.dispatch('assignSubmission', { ...p, importId: unassigned.importId, studentId: kaarel });
});
