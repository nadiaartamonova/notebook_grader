import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../backend/store.js';

const notebook = Buffer.from(
  JSON.stringify({
    nbformat: 4,
    metadata: { author: 'SECRET_METADATA' },
    cells: [
      {
        cell_type: 'markdown',
        source: [
          'Иван Иванов, S-123, ivan@example.com, +372 5555 1234\n',
          '![photo](attachment:photo.png)',
        ],
        metadata: {},
        attachments: { 'photo.png': { 'image/png': 'SECRET_IMAGE' } },
      },
      {
        cell_type: 'code',
        source: 'print("Иван")',
        metadata: {},
        outputs: [{ text: 'SECRET_OUTPUT' }],
      },
      { cell_type: 'raw', source: 'SECRET_RAW' },
    ],
  }),
);
async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'practicum-submissions-'));
  let store = new Store(directory);
  t.after(() => {
    store.close();
    const resolved = join(tmpdir(), 'practicum-submissions-');
    assert.ok(directory.startsWith(resolved));
    rmSync(directory, { recursive: true, force: true });
  });
  const profileId = (
    await store.dispatch('createProfile', {
      password: 'test',
      passwordRepeat: 'test',
      ...{ name: 'Преподаватель' },
    })
  ).active;
  const course = store.dispatch('createCourse', {
    profileId,
    name: 'Python',
    group: 'Группа',
    year: 2026,
    semester: 'Осень',
    mode: 'Дневное',
  }).courses[0];
  const context = { profileId, courseId: course.id };
  const student = store.dispatch('addStudent', { ...context, name: 'Иван Иванов', number: 'S-123' })
    .courses[0].students[0];
  const a = store.dispatch('saveAssignment', {
    ...context,
    name: 'Первое условие',
    description: 'Решить',
    additional: '',
    criteria: [{ name: 'Логика', description: '', points: 3 }],
  }).courses[0].assignments[0];
  const p = {
    ...context,
    assignmentId: a.id,
    studentId: student.id,
    name: 'Иванов.ipynb',
    base64: notebook.toString('base64'),
  };
  return {
    get store() {
      return store;
    },
    directory,
    p,
    a,
    async reopen() {
      store.close();
      store = new Store(directory);
      await store.dispatch('selectProfile', { id: p.profileId, password: 'test' });
      return store;
    },
    import(extra = {}) {
      return store.dispatch('importNotebook', { ...p, ...extra }).courses[0].assignments[0]
        .works[0];
    },
  };
}
test('exact original bytes persist; resubmission requires confirmation and creates a new version', async (t) => {
  const f = await fixture(t),
    first = f.import();
  const row = f.store.get('SELECT * FROM imports WHERE id=?', first.importId);
  assert.deepEqual(readFileSync(join(f.directory, 'files', row.storage_key)), notebook);
  assert.throws(() => f.import(), /Подтвердите/);
  const second = f.import({ confirmNewVersion: true });
  assert.equal(second.version, 2);
  assert.notEqual(first.versionId, second.versionId);
  assert.equal((await f.reopen()).snapshot().courses[0].assignments[0].works.length, 2);
  assert.deepEqual(readFileSync(join(f.directory, 'files', row.storage_key)), notebook);
});
test('invalid imports do not block valid ones and unassigned work can be assigned once', async (t) => {
  const f = await fixture(t);
  for (const extra of [
    { name: '../x.ipynb' },
    { base64: Buffer.from('not JSON').toString('base64') },
    { studentId: 'missing' },
  ])
    assert.throws(() => f.import(extra));
  assert.equal(f.store.get('SELECT COUNT(*) n FROM imports').n, 0);
  const work = f.import({ studentId: null });
  assert.equal(work.version, null);
  assert.throws(
    () => f.store.dispatch('prepareSubmission', { ...f.p, importId: work.importId }),
    /назначьте/,
  );
  f.store.dispatch('assignSubmission', { ...f.p, importId: work.importId });
  assert.throws(
    () => f.store.dispatch('assignSubmission', { ...f.p, importId: work.importId }),
    /уже назначен/,
  );
});
test('prepared copy excludes identities and notebook side channels; pins requirements; edits are versioned', async (t) => {
  const f = await fixture(t),
    work = f.import(),
    p = { ...f.p, importId: work.importId };
  f.store.dispatch('saveAssignment', {
    ...f.p,
    id: f.a.id,
    expectedRevision: f.a.revision_id,
    name: 'Изменённое условие',
    description: 'Другое',
    additional: '',
    criteria: [{ name: 'Другое', points: 10 }],
  });
  const copy = f.store.dispatch('prepareSubmission', p);
  for (const secret of ['Иван', 'S-123', 'ivan@example.com', '+372', 'SECRET_', 'Иванов.ipynb'])
    assert.ok(!copy.body.includes(secret), secret);
  assert.equal(JSON.parse(copy.body).assignment.title, 'Первое условие');
  assert.equal(JSON.parse(copy.body).assignment.criteria[0].points, 3);
  assert.equal(JSON.parse(copy.body).cells.length, 2);
  const updated = f.store.dispatch('savePreparedCopy', {
    ...p,
    expectedId: copy.id,
    body: copy.body,
    reviewed: true,
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.reviewed, 1);
  assert.throws(
    () => f.store.dispatch('savePreparedCopy', { ...p, expectedId: copy.id, body: copy.body }),
    /уже изменена/,
  );
  assert.equal(f.store.dispatch('prepareSubmission', p).id, updated.id);
  assert.equal(f.store.get('SELECT body FROM prepared_copies WHERE id=?', copy.id).body, copy.body);
  assert.ok(f.store.dispatch('readSubmission', p).cells[0].source.includes('Иван'));
  await f.store.dispatch('createProfile', {
    password: 'test',
    passwordRepeat: 'test',
    ...{ name: 'Другой' },
  });
  assert.throws(() => f.store.dispatch('readSubmission', p), /Профиль изменился/);
  assert.throws(
    () => f.store.dispatch('getPreparedCopy', { ...p, profileId: f.store.active() }),
    /Курс не найден/,
  );
});
test('interrupted imports recover bytes from staging; missing bytes are explicitly marked as errors', async (t) => {
  const f = await fixture(t),
    work = f.import({ studentId: null });
  const item = f.store.get('SELECT * FROM imports WHERE id=?', work.importId);
  renameSync(
    join(f.directory, 'files', item.storage_key),
    join(f.directory, 'staging', item.storage_key),
  );
  f.store.run("UPDATE imports SET status='pending' WHERE id=?", item.id);
  await f.reopen();
  assert.equal(f.store.get('SELECT status FROM imports WHERE id=?', item.id).status, 'ready');
  const second = f.import({ studentId: null }),
    row = f.store.get('SELECT * FROM imports WHERE id=?', second.importId);
  f.store.run("UPDATE imports SET status='pending',storage_key='missing.ipynb' WHERE id=?", row.id);
  await f.reopen();
  assert.equal(f.store.get('SELECT status FROM imports WHERE id=?', row.id).status, 'error');
});
test('changed original is rejected and a large valid notebook imports without regex overflow', async (t) => {
  const f = await fixture(t),
    work = f.import(),
    row = f.store.get('SELECT * FROM imports WHERE id=?', work.importId);
  writeFileSync(join(f.directory, 'files', row.storage_key), 'changed');
  assert.throws(
    () => f.store.dispatch('prepareSubmission', { ...f.p, importId: work.importId }),
    /изменился/,
  );
  const bytes = Buffer.from(
    JSON.stringify({
      nbformat: 4,
      cells: [{ cell_type: 'code', source: 'a'.repeat(4 * 1024 * 1024) }],
    }),
  );
  assert.equal(f.import({ base64: bytes.toString('base64'), confirmNewVersion: true }).version, 2);
});
