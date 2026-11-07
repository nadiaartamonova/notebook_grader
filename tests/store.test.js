import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../backend/store.js';
import { migrate } from '../backend/database/migrate.js';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'practicum-test-'));
  const stores = [];
  const open = () => {
    const s = new Store(directory);
    stores.push(s);
    return s;
  };
  t.after(() => {
    for (const s of stores) {
      try {
        s.close();
      } catch {}
    }
    rmSync(directory, { recursive: true, force: true });
  });
  return { open, directory };
}
async function setup(store) {
  const profileId = (
    await store.dispatch('createProfile', {
      password: 'test',
      passwordRepeat: 'test',
      ...{ name: 'Тестовый преподаватель' },
    })
  ).active;
  const state = store.dispatch('createCourse', {
    profileId,
    name: 'Программирование',
    group: 'ПЛП',
    year: 2026,
    semester: 'Весна',
    mode: 'Дневное',
  });
  return { profileId, courseId: state.courses[0].id };
}
const assignment = {
  name: 'Структуры данных',
  description: 'Условие',
  additional: 'Дополнение',
  criteria: [
    { name: 'Логика', points: 3, description: 'Полное решение' },
    { name: 'Оформление', points: 1.5, description: '' },
  ],
};

test('records and stable IDs survive reopening the SQLite file', async (t) => {
  const { open } = fixture(t),
    s = open(),
    p = await setup(s);
  s.dispatch('addStudent', { ...p, name: 'Иван Иванов', number: '123' });
  s.dispatch('saveAssignment', { ...p, ...assignment });
  const before = s.snapshot();
  s.close();
  const reopened = open();
  assert.equal(reopened.active(), null);
  await reopened.dispatch('selectProfile', { id: p.profileId, password: 'test' });
  assert.deepEqual(reopened.snapshot(), before);
});

test('copy includes criteria and rules, excludes enrollments and remains independent', async (t) => {
  const s = fixture(t).open(),
    p = await setup(s);
  s.dispatch('saveRules', {
    ...p,
    expectedRevision: s.snapshot().courses[0].rulesRevision,
    content: 'Исходные правила',
  });
  s.dispatch('addStudent', { ...p, name: 'Студент', number: '42' });
  s.dispatch('saveAssignment', { ...p, ...assignment });
  let state = s.dispatch('copyCourse', {
    profileId: p.profileId,
    sourceId: p.courseId,
    name: 'Копия',
    group: 'УП',
    year: 2027,
    semester: 'Осень',
    mode: 'Сессионное',
  });
  const original = state.courses[0],
    copy = state.courses[1];
  assert.equal(copy.rules, original.rules);
  assert.equal(copy.students.length, 0);
  assert.equal(copy.assignments[0].max, 4.5);
  assert.notEqual(copy.assignments[0].criteria[0].id, original.assignments[0].criteria[0].id);
  state = s.dispatch('saveRules', {
    profileId: p.profileId,
    courseId: copy.id,
    content: 'Другие правила',
    expectedRevision: copy.rulesRevision,
  });
  assert.equal(state.courses[0].rules, 'Исходные правила');
});

test('revisions preserve original content and reject stale editors and direct SQL changes', async (t) => {
  const s = fixture(t).open(),
    p = await setup(s);
  const a = s.dispatch('saveAssignment', { ...p, ...assignment }).courses[0].assignments[0];
  s.dispatch('saveAssignment', {
    ...p,
    ...assignment,
    id: a.id,
    expectedRevision: a.revision_id,
    name: 'Новое название',
  });
  assert.equal(
    s.get('SELECT name FROM assignment_revisions WHERE id=?', a.revision_id).name,
    assignment.name,
  );
  assert.equal(s.snapshot().courses[0].assignments[0].version, 2);
  assert.throws(
    () =>
      s.dispatch('saveAssignment', {
        ...p,
        ...assignment,
        id: a.id,
        expectedRevision: a.revision_id,
      }),
    /уже изменено/,
  );
  assert.throws(
    () => s.run('UPDATE assignment_revisions SET name=? WHERE id=?', 'Ошибка', a.revision_id),
    /Immutable/,
  );
  assert.throws(
    () => s.run('DELETE FROM criteria WHERE revision_id=?', a.revision_id),
    /Immutable/,
  );
  const old = s.snapshot().courses[0].rulesRevision;
  s.dispatch('saveRules', { ...p, expectedRevision: old, content: 'Новые правила' });
  assert.throws(
    () => s.dispatch('saveRules', { ...p, expectedRevision: old, content: 'Старая правка' }),
    /уже изменены/,
  );
  assert.equal(
    s.get('SELECT rule_revision_id FROM assignment_revisions WHERE id=?', a.revision_id)
      .rule_revision_id,
    old,
  );
});

test('invalid scores and cross-profile commands cannot create or modify records', async (t) => {
  const s = fixture(t).open(),
    p = await setup(s);
  for (const points of [-1, 0, 0.3, NaN, 1001]) {
    assert.throws(
      () =>
        s.dispatch('saveAssignment', {
          ...p,
          ...assignment,
          criteria: [{ name: 'Критерий', points }],
        }),
      /Баллы/,
    );
  }
  assert.equal(s.get('SELECT COUNT(*) AS n FROM assignments').n, 0);
  const other = (
    await s.dispatch('createProfile', {
      password: 'test',
      passwordRepeat: 'test',
      ...{ name: 'Другой' },
    })
  ).active;
  assert.throws(
    () =>
      s.dispatch('saveRules', { profileId: other, courseId: p.courseId, content: 'Чужая правка' }),
    /не найден/,
  );
  assert.throws(() => s.dispatch('createCourse', { ...p, name: 'Ошибка' }), /Профиль изменился/);
  assert.equal(s.snapshot().courses.length, 0);
});

test('student numbers join the same student to courses and allow namesakes', async (t) => {
  const s = fixture(t).open(),
    p = await setup(s);
  s.dispatch('addStudent', { ...p, name: 'Иван Иванов', number: '1' });
  s.dispatch('addStudent', { ...p, name: 'Иван Иванов', number: '2' });
  assert.throws(
    () => s.dispatch('addStudent', { ...p, name: 'Другой человек', number: '1' }),
    /другим именем/,
  );
  assert.throws(
    () => s.dispatch('addStudent', { ...p, name: 'Иван Иванов', number: '1' }),
    /уже добавлен/,
  );
  const c2 = s.dispatch('createCourse', {
    profileId: p.profileId,
    name: 'Другой курс',
    group: 'УП',
    year: 2026,
    semester: 'Осень',
    mode: 'Сессионное',
  }).courses[1];
  s.dispatch('addStudent', {
    profileId: p.profileId,
    courseId: c2.id,
    name: 'Иван Иванов',
    number: '1',
  });
  assert.equal(s.get('SELECT COUNT(*) AS n FROM students').n, 2);
  assert.equal(s.get('SELECT COUNT(*) AS n FROM enrollments').n, 3);
});

test('transaction failure rolls back the entire copied course', async (t) => {
  const s = fixture(t).open(),
    p = await setup(s);
  s.dispatch('saveAssignment', { ...p, ...assignment });
  const originalInsert = s.repositories.assignments.insertRevision;
  s.repositories.assignments.insertRevision = () => {
    throw new Error('Simulated disk failure');
  };
  assert.throws(
    () =>
      s.dispatch('copyCourse', {
        profileId: p.profileId,
        sourceId: p.courseId,
        name: 'Копия',
        group: 'УП',
        year: 2027,
        semester: 'Осень',
        mode: 'Сессионное',
      }),
    /disk failure/,
  );
  s.repositories.assignments.insertRevision = originalInsert;
  assert.equal(s.get('SELECT COUNT(*) AS n FROM courses').n, 1);
  assert.equal(s.get('SELECT COUNT(*) AS n FROM assignments').n, 1);
});

test('migration runner preserves data, applies only new migrations and rolls back failure', () => {
  const db = new DatabaseSync(':memory:');
  const first = (db) =>
    db.exec(
      "CREATE TABLE sample(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO sample VALUES(1,'Сохранить');",
    );
  try {
    migrate(db, [first]);
    migrate(db, [first, (db) => db.exec('ALTER TABLE sample ADD COLUMN label TEXT;')]);
    assert.equal(db.prepare('SELECT name FROM sample').get().name, 'Сохранить');
    assert.throws(() => migrate(db, [first]), /новой версией/);
    assert.throws(
      () =>
        migrate(db, [
          first,
          () => {},
          (db) => {
            db.exec('CREATE TABLE incomplete(id);');
            throw new Error('Failure');
          },
        ]),
      /Failure/,
    );
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(
      db.prepare("SELECT name FROM sqlite_master WHERE name='incomplete'").get(),
      undefined,
    );
  } finally {
    db.close();
  }
});
