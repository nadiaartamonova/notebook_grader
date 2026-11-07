import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../backend/store.js';

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'practicum-lifecycle-'));
  const store = new Store(directory);
  t.after(() => {
    store.close();
    assert.ok(directory.startsWith(join(tmpdir(), 'practicum-lifecycle-')));
    rmSync(directory, { recursive: true, force: true });
  });
  const profileId = (
    await store.dispatch('createProfile', {
      password: 'test',
      passwordRepeat: 'test',
      ...{ name: 'Преподаватель' },
    })
  ).active;
  const courseId = store.dispatch('createCourse', {
    profileId,
    name: 'Python',
    group: 'A',
    year: 2026,
    semester: 'Осень',
    mode: 'Дневное',
  }).courses[0].id;
  const p = { profileId, courseId };
  store.dispatch('addStudent', { ...p, name: 'Alice Magi', number: 'A' });
  store.dispatch('addStudent', { ...p, name: 'Bob Brown', number: 'B' });
  const students = store.snapshot().courses[0].students;
  p.assignmentId = store.dispatch('saveAssignment', {
    ...p,
    name: 'Задание',
    criteria: [{ name: 'Логика', points: 5 }],
  }).courses[0].assignments[0].id;
  const bytes = Buffer.from(
    JSON.stringify({
      nbformat: 4,
      cells: [{ cell_type: 'markdown', source: 'Alice Mägi and Bob Brown' }],
    }),
  );
  const works = () => store.snapshot().courses[0].assignments[0].works;
  const upload = (studentId) =>
    store.dispatch('importNotebook', {
      ...p,
      studentId,
      name: 'Task1.ipynb',
      base64: bytes.toString('base64'),
      confirmNewVersion: true,
    }).courses[0].assignments[0].works[0];
  const change = (work, studentId, extra = {}) =>
    store.dispatch('changeSubmissionAuthor', {
      ...p,
      importId: work.importId,
      expectedAuthorEventId: work.authorEventId,
      studentId,
      ...extra,
    });
  return { store, p, students, upload, change, works, directory, bytes };
}

test('author changes append history, invalidate all old copies and reserve version numbers', async (t) => {
  const f = await fixture(t),
    [a, b] = f.students;
  const first = f.upload(a.id),
    second = f.upload(b.id),
    p = { ...f.p, importId: first.importId };
  const old = f.store.dispatch('prepareSubmission', p);
  const edited = f.store.dispatch('savePreparedCopy', {
    ...p,
    expectedId: old.id,
    body: old.body,
    reviewed: true,
  });
  assert.throws(() => f.change(first, b.id), /Подтвердите/);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM author_events').n, 2);
  f.change(first, b.id, { confirmNewVersion: true });
  const changed = f.works().find((w) => w.importId === first.importId);
  assert.equal(changed.studentId, b.id);
  assert.equal(changed.version, 2);
  assert.equal(changed.preparedId, null);
  assert.equal(f.store.dispatch('getPreparedCopy', p), null);
  assert.throws(
    () => f.store.dispatch('savePreparedCopy', { ...p, expectedId: edited.id, body: edited.body }),
    /уже изменена/,
  );
  assert.equal(f.store.get('SELECT body FROM prepared_copies WHERE id=?', old.id).body, old.body);
  const history = f.store.dispatch('getSubmissionHistory', p);
  assert.deepEqual(
    history.authors.map((e) => e.name),
    [a.name, b.name],
  );
  assert.ok(history.authors.every((e) => e.createdAt && e.changedBy === 'Преподаватель'));
  assert.equal(history.authors[1].previousId, history.authors[0].id);
  assert.ok(history.copies.every((c) => c.invalidReason === 'Автор работы изменён'));
  const fresh = f.store.dispatch('prepareSubmission', p);
  assert.notEqual(fresh.request_id, old.request_id);
  assert.equal(fresh.revision, 3);
  assert.ok(JSON.parse(fresh.body).cells[0].source.includes('Alice'));
  assert.ok(!JSON.parse(fresh.body).cells[0].source.includes('Bob'));
  assert.equal(f.upload(a.id).version, 2);
  f.change(changed, a.id, { confirmNewVersion: true });
  assert.equal(f.works().find((w) => w.importId === first.importId).version, 3);
  assert.equal(f.works().find((w) => w.importId === second.importId).version, 1);
  assert.throws(() => f.change(first, b.id, { confirmNewVersion: true }), /уже изменён/);
  assert.throws(() => f.store.run('UPDATE submission_versions SET version=99'), /Immutable/);
  assert.throws(() => f.store.run('DELETE FROM prepared_copies'), /Immutable/);
  assert.throws(() => f.store.run('UPDATE author_events SET student_name=?', 'Other'), /Immutable/);
});

test('author change rolls back the entire event when copy invalidation fails', async (t) => {
  const f = await fixture(t),
    work = f.upload(f.students[0].id),
    p = { ...f.p, importId: work.importId };
  f.store.dispatch('prepareSubmission', p);
  const original = f.store.repositories.submissions.invalidateCopies;
  f.store.repositories.submissions.invalidateCopies = () => {
    throw Error('Simulated failure');
  };
  assert.throws(() => f.change(work, f.students[1].id), /Simulated/);
  f.store.repositories.submissions.invalidateCopies = original;
  assert.equal(f.works()[0].studentId, f.students[0].id);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM author_events').n, 1);
  assert.ok(f.store.dispatch('getPreparedCopy', p));
});

test('soft deletion retains bytes and history but blocks every current-work operation', async (t) => {
  const f = await fixture(t),
    work = f.upload(f.students[0].id),
    p = { ...f.p, importId: work.importId };
  f.store.dispatch('prepareSubmission', p);
  const file = f.store.get('SELECT storage_key FROM imports WHERE id=?', work.importId).storage_key;
  assert.throws(() => f.store.dispatch('deleteSubmission', p), /Подтвердите/);
  f.store.dispatch('deleteSubmission', { ...p, confirmDelete: true });
  assert.equal(f.works().length, 0);
  assert.deepEqual(readFileSync(join(f.directory, 'files', file)), f.bytes);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM author_events').n, 1);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM work_deletions').n, 1);
  for (const cmd of [
    'assignSubmission',
    'changeSubmissionAuthor',
    'prepareSubmission',
    'savePreparedCopy',
    'getPreparedCopy',
    'readSubmission',
  ])
    assert.throws(
      () =>
        f.store.dispatch(cmd, {
          ...p,
          studentId: f.students[1].id,
          expectedAuthorEventId: work.authorEventId,
        }),
      /не найдена/,
    );
  assert.equal(f.upload(f.students[0].id).version, 2);
});

test('student editing enforces profile uniqueness, preserves copies and exclusion respects current work', async (t) => {
  const f = await fixture(t),
    [a, b] = f.students,
    work = f.upload(a.id),
    p = { ...f.p, studentId: a.id };
  const copy = f.store.dispatch('prepareSubmission', { ...f.p, importId: work.importId });
  assert.throws(
    () => f.store.dispatch('editStudent', { ...p, name: 'Changed', number: b.number }),
    /принадлежит/,
  );
  assert.throws(
    () => f.store.dispatch('editStudent', { ...p, name: ' ', number: 'X' }),
    /Проверьте/,
  );
  f.store.dispatch('editStudent', { ...p, name: 'Alice Mägi', number: 'A-2' });
  assert.equal(f.store.get('SELECT name FROM students WHERE id=?', a.id).name, 'Alice Mägi');
  assert.equal(
    f.store.dispatch('getPreparedCopy', { ...f.p, importId: work.importId }).body,
    copy.body,
  );
  assert.throws(
    () => f.store.dispatch('excludeStudent', { ...p, confirmExclude: true }),
    /Сначала переназначьте/,
  );
  f.change(work, b.id);
  f.store.dispatch('excludeStudent', { ...p, confirmExclude: true });
  assert.equal(f.store.snapshot().courses[0].students.length, 1);
  assert.throws(() => f.change(f.works()[0], a.id, { confirmNewVersion: true }), /текущей группы/);
  f.store.dispatch('addStudent', { ...f.p, name: 'Alice Mägi', number: 'A-2' });
  assert.equal(f.store.snapshot().courses[0].students.length, 2);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM enrollments').n, 2);
  f.store.dispatch('deleteSubmission', { ...f.p, importId: work.importId, confirmDelete: true });
  f.store.dispatch('excludeStudent', { ...f.p, studentId: b.id, confirmExclude: true });
  assert.equal(f.store.snapshot().courses[0].students.length, 1);
});

test('cross-course and cross-profile commands cannot alter work or students', async (t) => {
  const f = await fixture(t),
    work = f.upload(f.students[0].id);
  const other = f.store.dispatch('createCourse', {
    profileId: f.p.profileId,
    name: 'Other',
    group: 'B',
    year: 2026,
    semester: 'Осень',
    mode: 'Дневное',
  }).courses[1];
  const otherStudent = f.store.dispatch('addStudent', {
    profileId: f.p.profileId,
    courseId: other.id,
    name: 'Other',
    number: 'OTHER',
  }).courses[1].students[0];
  assert.throws(() => f.change(work, otherStudent.id), /текущей группы/);
  assert.throws(
    () =>
      f.store.dispatch('editStudent', {
        ...f.p,
        studentId: otherStudent.id,
        name: 'Hack',
        number: '',
      }),
    /не найден/,
  );
  assert.throws(
    () =>
      f.store.dispatch('deleteSubmission', {
        ...f.p,
        courseId: other.id,
        importId: work.importId,
        confirmDelete: true,
      }),
    /Задание не найдено/,
  );
  const profileId = (
    await f.store.dispatch('createProfile', {
      password: 'test',
      passwordRepeat: 'test',
      ...{ name: 'Другой' },
    })
  ).active;
  for (const cmd of ['changeSubmissionAuthor', 'deleteSubmission', 'editStudent', 'excludeStudent'])
    assert.throws(
      () =>
        f.store.dispatch(cmd, {
          ...f.p,
          profileId,
          importId: work.importId,
          studentId: f.students[0].id,
          confirmDelete: true,
          confirmExclude: true,
        }),
      /Курс не найден/,
    );
});

test('copy preparation and deletion are atomic even if history persistence fails', async (t) => {
  const f = await fixture(t),
    work = f.upload(f.students[0].id),
    p = { ...f.p, importId: work.importId };
  const originalLink = f.store.repositories.submissions.linkCopy;
  f.store.repositories.submissions.linkCopy = () => {
    throw Error('History failure');
  };
  assert.throws(() => f.store.dispatch('prepareSubmission', p), /History failure/);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM prepared_copies').n, 0);
  f.store.repositories.submissions.linkCopy = originalLink;
  f.store.dispatch('prepareSubmission', p);
  const originalInvalidate = f.store.repositories.submissions.invalidateCopies;
  f.store.repositories.submissions.invalidateCopies = () => {
    throw Error('History failure');
  };
  assert.throws(
    () => f.store.dispatch('deleteSubmission', { ...p, confirmDelete: true }),
    /History failure/,
  );
  f.store.repositories.submissions.invalidateCopies = originalInvalidate;
  assert.equal(f.works().length, 1);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM work_deletions').n, 0);
  assert.ok(f.store.dispatch('getPreparedCopy', p));
});

test('unassigned imports can be hidden, and failed import leaves no partial database rows', async (t) => {
  const f = await fixture(t),
    work = f.upload(null),
    p = { ...f.p, importId: work.importId };
  f.store.run("UPDATE imports SET status='pending' WHERE id=?", work.importId);
  f.store.dispatch('deleteSubmission', { ...p, confirmDelete: true });
  assert.equal(f.store.repositories.submissions.listPending().length, 0);
  assert.throws(
    () => f.store.dispatch('assignSubmission', { ...p, studentId: f.students[0].id }),
    /не найдена/,
  );
  const before = f.store.get('SELECT COUNT(*) n FROM imports').n;
  const save = f.store.files.saveOriginal;
  f.store.files.saveOriginal = () => {
    throw Error('Disk failure');
  };
  assert.throws(() => f.upload(f.students[0].id), /Не удалось завершить импорт/);
  f.store.files.saveOriginal = save;
  assert.equal(f.store.get('SELECT COUNT(*) n FROM imports').n, before);
  assert.equal(f.store.get('SELECT COUNT(*) n FROM submission_versions').n, 0);
});
