import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../backend/store.js';
import { passwordProblems } from '../backend/auth/password-policy.js';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../backend/database/migrate.js';
import { workspaceSchema } from '../backend/database/migrations/001-workspace.js';
import { submissionSchema } from '../backend/database/migrations/002-submissions.js';
import { workLifecycleSchema } from '../backend/database/migrations/003-work-lifecycle.js';
import { authAndArchiveSchema } from '../backend/database/migrations/004-auth-and-archive.js';
import { hashSecret, parameters } from '../backend/auth/password-hash.js';

const secret = 'Complex-secret!42';
function fixture(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'practicum-auth-review-'));
  let store = new Store(directory, options);
  t.after(() => {
    store.close();
    assert.ok(directory.startsWith(join(tmpdir(), 'practicum-auth-review-')));
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    get store() {
      return store;
    },
    reopen() {
      store.close();
      store = new Store(directory, options);
      return store;
    },
  };
}
async function profile(store, password = secret) {
  return store.dispatch('createProfile', { name: 'Учитель', password, passwordRepeat: password });
}
async function workFixture(t) {
  const f = fixture(t),
    s = f.store,
    created = await profile(s),
    p = { profileId: created.active };
  p.courseId = s.dispatch('createCourse', {
    ...p,
    name: 'Python',
    group: 'A',
    year: 2026,
    semester: 'Осень',
    mode: 'Дневное',
  }).courses[0].id;
  const student = s.dispatch('addStudent', { ...p, name: 'Автор', number: '1' }).courses[0]
    .students[0];
  const assignment = s.dispatch('saveAssignment', {
    ...p,
    name: 'Задание',
    criteria: [
      { name: 'Логика', points: 3 },
      { name: 'Стиль', points: 2 },
    ],
  }).courses[0].assignments[0];
  p.assignmentId = assignment.id;
  const work = s.dispatch('importNotebook', {
    ...p,
    studentId: student.id,
    name: 'task.ipynb',
    base64: Buffer.from(
      JSON.stringify({ nbformat: 4, cells: [{ cell_type: 'code', source: 'print(1)' }] }),
    ).toString('base64'),
  }).courses[0].assignments[0].works[0];
  p.importId = work.importId;
  p.expectedAuthorEventId = work.authorEventId;
  const scores = assignment.criteria.map((c) => ({
    criterionId: c.id,
    points: c.points,
    comment: '',
  }));
  return { ...f, s, p, assignment, student, scores };
}
test('scrypt stores distinct salts and hashes only; IPC state never returns credentials', async (t) => {
  const f = fixture(t),
    first = await profile(f.store),
    second = await profile(f.store);
  const rows = f.store.all('SELECT * FROM auth_methods');
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].password_salt, rows[1].password_salt);
  assert.notEqual(rows[0].password_hash, rows[1].password_hash);
  assert.equal(JSON.parse(rows[0].parameters).N, 16384);
  for (const value of [secret, first.recoveryCode, second.recoveryCode])
    assert.ok(!JSON.stringify(rows).includes(value));
  assert.ok(!JSON.stringify(f.store.snapshot()).includes(rows[0].password_hash));
  assert.equal(f.store.get("SELECT value FROM settings WHERE key='active'"), undefined);
  await f.store.dispatch('leaveProfile');
  const logged = await f.store.dispatch('selectProfile', { id: first.active, password: secret });
  assert.equal(logged.active, first.active);
  assert.equal(logged.recoveryCode, undefined);
  assert.equal(f.reopen().active(), null);
  assert.equal(f.store.snapshot().courses.length, 0);
  await assert.rejects(
    f.store.dispatch('selectProfile', { id: first.active, password: 'wrong' }),
    /Неверный пароль/,
  );
});
test('strict and development policies are enforced by backend and mismatch is rejected', async (t) => {
  assert.deepEqual(passwordProblems('a', 'test'), []);
  assert.ok(passwordProblems('', 'test').length);
  assert.ok(passwordProblems('abcdefgh', 'strict').some((x) => x.includes('спецсимвол')));
  assert.ok(passwordProblems('!short', 'strict').some((x) => x.includes('8')));
  assert.deepEqual(passwordProblems('абвгдеж!', 'strict'), []);
  const f = fixture(t, { passwordMode: 'strict' });
  await assert.rejects(profile(f.store, 'a'), /8/);
  await assert.rejects(
    f.store.dispatch('createProfile', { name: 'x', password: secret, passwordRepeat: 'different' }),
    /не совпадают/,
  );
  assert.equal(f.store.snapshot().profiles.length, 0);
  await profile(f.store);
});
test('five failed attempts lock login for 30 seconds, including parallel attempts', async (t) => {
  let clock = 1000;
  const f = fixture(t, { clock: () => clock }),
    created = await profile(f.store);
  await f.store.dispatch('leaveProfile');
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      f.store.dispatch('selectProfile', { id: created.active, password: 'bad' }),
    ),
  );
  assert.ok(results.every((r) => r.status === 'rejected'));
  assert.match(results[4].reason.message, /30 секунд/);
  await assert.rejects(
    f.store.dispatch('selectProfile', { id: created.active, password: secret }),
    /30 секунд/,
  );
  clock += 30000;
  assert.equal(
    (await f.store.dispatch('selectProfile', { id: created.active, password: secret })).active,
    created.active,
  );
});
test('legacy profile requires initial password; password change and recovery rotate recovery code', async (t) => {
  const f = fixture(t);
  f.store.run('INSERT INTO profiles VALUES (?,?,?)', 'legacy', 'Учитель', '2026-01-01');
  assert.equal(f.store.snapshot().profiles[0].needsPassword, 1);
  await assert.rejects(
    f.store.dispatch('selectProfile', { id: 'legacy', password: 'a' }),
    /Сначала задайте/,
  );
  const first = await f.store.dispatch('setupPassword', {
    id: 'legacy',
    password: 'a',
    passwordRepeat: 'a',
  });
  await assert.rejects(
    f.store.dispatch('setupPassword', { id: 'legacy', password: 'b', passwordRepeat: 'b' }),
    /уже установлен/,
  );
  await assert.rejects(
    f.store.dispatch('changePassword', {
      profileId: 'legacy',
      currentPassword: 'bad',
      password: 'b',
      passwordRepeat: 'b',
    }),
    /Неверный пароль/,
  );
  const changed = await f.store.dispatch('changePassword', {
    profileId: 'legacy',
    currentPassword: 'a',
    password: 'b',
    passwordRepeat: 'b',
  });
  assert.notEqual(changed.recoveryCode, first.recoveryCode);
  await f.store.dispatch('leaveProfile');
  await assert.rejects(
    f.store.dispatch('selectProfile', { id: 'legacy', password: 'a' }),
    /Неверный пароль/,
  );
  await assert.rejects(
    f.store.dispatch('recoverProfile', {
      id: 'legacy',
      recoveryCode: first.recoveryCode,
      password: 'c',
      passwordRepeat: 'c',
    }),
    /Неверный код/,
  );
  const recovered = await f.store.dispatch('recoverProfile', {
    id: 'legacy',
    recoveryCode: changed.recoveryCode,
    password: 'c',
    passwordRepeat: 'c',
  });
  assert.equal(recovered.active, 'legacy');
  assert.notEqual(recovered.recoveryCode, changed.recoveryCode);
  await f.store.dispatch('leaveProfile');
  await f.store.dispatch('selectProfile', { id: 'legacy', password: 'c' });
});
test('archive and restore preserve assignment revisions and works, and require correct owner', async (t) => {
  const f = await workFixture(t),
    { s, p } = f;
  assert.throws(() => s.dispatch('archiveAssignment', p), /Подтвердите/);
  const archived = s.dispatch('archiveAssignment', { ...p, confirmArchive: true }).courses[0]
    .assignments[0];
  assert.equal(archived.archived, 1);
  assert.equal(archived.works.length, 1);
  assert.equal(archived.revision_id, f.assignment.revision_id);
  assert.equal(s.dispatch('restoreAssignment', p).courses[0].assignments[0].archived, 0);
  const other = await profile(s);
  assert.throws(
    () => s.dispatch('archiveAssignment', { ...p, profileId: other.active, confirmArchive: true }),
    /не найден/,
  );
});
test('draft, approval and correction have immutable snapshots, totals and separate AI placeholder', async (t) => {
  const { s, p, scores } = await workFixture(t);
  let result = s.dispatch('saveReview', {
    ...p,
    status: 'draft',
    scores: [],
    feedback: 'Черновик',
  });
  assert.equal(result.current.total, 0);
  assert.equal(result.approved, null);
  assert.throws(
    () =>
      s.dispatch('saveReview', {
        ...p,
        expectedReviewId: result.current.id,
        status: 'approved',
        scores: [],
      }),
    /всем критериям/,
  );
  result = s.dispatch('saveReview', {
    ...p,
    expectedReviewId: result.current.id,
    status: 'approved',
    scores,
    feedback: 'Хорошо',
  });
  const approvedId = result.current.id;
  assert.equal(result.approved.total, 5);
  const correction = s.dispatch('saveReview', {
    ...p,
    expectedReviewId: approvedId,
    status: 'draft',
    scores: [{ ...scores[0], points: 2.5 }, scores[1]],
    feedback: 'Уточнение',
  });
  assert.equal(correction.current.previous_id, approvedId);
  assert.equal(correction.approved.id, approvedId);
  const row = s.snapshot().courses[0].assignments[0].works[0];
  assert.equal(row.reviewStatus, 'draft');
  assert.equal(row.teacherScore, 5);
  assert.equal(row.aiScore, null);
  const final = s.dispatch('saveReview', {
    ...p,
    expectedReviewId: correction.current.id,
    status: 'approved',
    scores: [{ ...scores[0], points: 2.5 }, scores[1]],
  });
  assert.equal(final.approved.total, 4.5);
  assert.equal(final.history.length, 4);
  assert.throws(
    () => s.run("UPDATE teacher_reviews SET feedback='rewrite' WHERE id=?", approvedId),
    /Immutable/,
  );
  assert.throws(
    () => s.run('DELETE FROM review_scores WHERE review_id=?', approvedId),
    /Immutable/,
  );
  assert.throws(
    () => s.dispatch('saveReview', { ...p, expectedReviewId: approvedId, status: 'draft', scores }),
    /уже изменена/,
  );
});
test('grade validation uses pinned criteria and rolls back invalid or incomplete decisions', async (t) => {
  const { s, p, scores, assignment } = await workFixture(t);
  s.dispatch('saveAssignment', {
    ...p,
    id: assignment.id,
    expectedRevision: assignment.revision_id,
    name: 'Changed',
    criteria: [{ name: 'New', points: 100 }],
  });
  for (const points of [-1, 3.5, 0.3, NaN, Infinity])
    assert.throws(
      () =>
        s.dispatch('saveReview', {
          ...p,
          status: 'draft',
          scores: [{ ...scores[0], points }, scores[1]],
        }),
      /шаг/,
    );
  assert.throws(
    () => s.dispatch('saveReview', { ...p, status: 'draft', scores: [scores[0], scores[0]] }),
    /повторяющийся/,
  );
  assert.equal(s.get('SELECT COUNT(*) n FROM teacher_reviews').n, 0);
  assert.equal(s.dispatch('getReview', p).criteria[0].max, 3);
  assert.equal(s.dispatch('saveReview', { ...p, status: 'approved', scores }).approved.total, 5);
});
test('review cannot cross profile, deleted work or changed author boundaries', async (t) => {
  const { s, p, scores } = await workFixture(t);
  const draft = s.dispatch('saveReview', { ...p, status: 'draft', scores });
  const second = s
    .dispatch('addStudent', { ...p, name: 'Другой', number: '2' })
    .courses[0].students.find((student) => student.number === '2');
  s.dispatch('changeSubmissionAuthor', {
    ...p,
    expectedAuthorEventId: p.expectedAuthorEventId,
    studentId: second.id,
  });
  assert.equal(s.dispatch('getReview', p).current, null);
  assert.throws(
    () =>
      s.dispatch('saveReview', {
        ...p,
        expectedReviewId: draft.current.id,
        status: 'draft',
        scores,
      }),
    /Автор изменился/,
  );
  assert.equal(s.get('SELECT COUNT(*) n FROM teacher_reviews').n, 1);
  const other = await profile(s);
  assert.throws(() => s.dispatch('getReview', { ...p, profileId: other.active }), /не найден/);
  await s.dispatch('selectProfile', { id: p.profileId, password: secret });
  s.dispatch('deleteSubmission', { ...p, confirmDelete: true });
  assert.throws(() => s.dispatch('getReview', p), /недоступна/);
  assert.throws(() => s.dispatch('saveReview', { ...p, status: 'draft', scores }), /недоступна/);
});

test('migration 4 to 5 preserves password hashes and permits login without persistent session', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'practicum-auth-migration-'));
  let store;
  t.after(() => {
    store?.close();
    assert.ok(directory.startsWith(join(tmpdir(), 'practicum-auth-migration-')));
    rmSync(directory, { recursive: true, force: true });
  });
  const db = new DatabaseSync(join(directory, 'practicum.sqlite3'));
  migrate(db, [workspaceSchema, submissionSchema, workLifecycleSchema, authAndArchiveSchema]);
  db.prepare('INSERT INTO profiles VALUES (?,?,?)').run('old', 'Учитель', '2026-01-01');
  const password = await hashSecret(secret),
    recovery = await hashSecret('test-recovery');
  db.prepare('INSERT INTO auth_methods VALUES (?,?,?,?,?,?,?,?)').run(
    'old',
    'password',
    password.hash,
    password.salt,
    JSON.stringify(parameters),
    recovery.hash,
    recovery.salt,
    '2026-01-01',
  );
  const before = db.prepare('SELECT * FROM auth_methods').get();
  db.close();
  store = new Store(directory);
  assert.equal(store.active(), null);
  assert.deepEqual(store.get('SELECT * FROM auth_methods'), before);
  assert.equal(store.snapshot().profiles[0].needsPassword, 0);
  assert.equal(
    (await store.dispatch('selectProfile', { id: 'old', password: secret })).active,
    'old',
  );
});

test('review transaction rolls back if a score cannot be stored', async (t) => {
  const { s, p, scores } = await workFixture(t);
  s.db.exec(
    "CREATE TRIGGER reject_test_score BEFORE INSERT ON review_scores BEGIN SELECT RAISE(ABORT,'Test failure'); END;",
  );
  assert.throws(
    () => s.dispatch('saveReview', { ...p, status: 'approved', scores }),
    /Test failure/,
  );
  assert.equal(s.get('SELECT COUNT(*) n FROM teacher_reviews').n, 0);
});
