import { workLifecycleSchema } from '../backend/database/migrations/003-work-lifecycle.js';
import { authAndArchiveSchema } from '../backend/database/migrations/004-auth-and-archive.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { migrate } from '../backend/database/migrate.js';
import { workspaceSchema } from '../backend/database/migrations/001-workspace.js';
import { submissionSchema } from '../backend/database/migrations/002-submissions.js';
import { Store } from '../backend/store.js';

for (const schemaVersion of [1, 2, 3, 4])
  test(`real schema ${schemaVersion} upgrades to current schema without losing data or immutable triggers`, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'practicum-migration3-'));
    let store;
    t.after(() => {
      store?.close();
      assert.ok(directory.startsWith(join(tmpdir(), 'practicum-migration3-')));
      rmSync(directory, { recursive: true, force: true });
    });
    const db = new DatabaseSync(join(directory, 'practicum.sqlite3'));
    db.exec('PRAGMA foreign_keys=ON');
    migrate(db, [workspaceSchema, submissionSchema].slice(0, Math.min(2, schemaVersion)));
    db.exec(`
    INSERT INTO profiles VALUES ('p','Учитель','2026-01-01');
    INSERT INTO settings VALUES ('active','p');
    INSERT INTO courses VALUES ('c','p','Python','A',2026,'Весна','Дневное',NULL,'2026-01-01');
    INSERT INTO rule_revisions VALUES ('r','c',1,'Правила','2026-01-01');
    INSERT INTO students VALUES ('s','p','Kaarel Magi','123','2026-01-01');
    INSERT INTO enrollments VALUES ('e','c','s');
    INSERT INTO assignments VALUES ('a','c','2026-01-01');
    INSERT INTO assignment_revisions VALUES ('ar','a',1,'Задание','Условие','','r','2026-01-01');
    INSERT INTO criteria VALUES ('cr','ar',0,'Логика','',6);
  `);
    const bytes = Buffer.from(
      JSON.stringify({ nbformat: 4, cells: [{ cell_type: 'markdown', source: 'Kaarel Mägi' }] }),
    );
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (schemaVersion >= 2) {
      mkdirSync(join(directory, 'files'));
      writeFileSync(join(directory, 'files', 'legacy.ipynb'), bytes);
      db.prepare('INSERT INTO imports VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
        'i',
        'a',
        'ar',
        'Task1_KaarelMagi.ipynb',
        'legacy.ipynb',
        hash,
        bytes.length,
        1,
        'ready',
        '',
        '2026-01-01',
      );
      db.exec(`INSERT INTO submissions VALUES ('sub','a','e');
      INSERT INTO submission_versions VALUES ('v','sub',1,'i','2026-01-01');`);
      db.prepare('INSERT INTO prepared_copies VALUES (?,?,?,?,?,?,?,?)').run(
        'copy',
        'v',
        1,
        'legacy',
        '{"requestId":"legacy","assignment":{},"cells":[]}',
        '{"names":1}',
        1,
        '2026-01-01',
      );
    }
    if (schemaVersion >= 3)
      migrate(
        db,
        [workspaceSchema, submissionSchema, workLifecycleSchema, authAndArchiveSchema].slice(
          0,
          schemaVersion,
        ),
      );
    const tables = [
      'profiles',
      'courses',
      'students',
      'assignments',
      'assignment_revisions',
      'rule_revisions',
      'criteria',
      ...(schemaVersion >= 2
        ? ['imports', 'submissions', 'submission_versions', 'prepared_copies']
        : []),
    ];
    const before = Object.fromEntries(
      tables.map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all()]),
    );
    db.close();
    store = new Store(directory);
    assert.equal(store.active(), null);
    await store.dispatch('setupPassword', { id: 'p', password: 'test', passwordRepeat: 'test' });
    assert.equal(store.get('PRAGMA user_version').user_version, 5);
    for (const table of tables)
      assert.deepEqual(
        store.all(`SELECT * FROM ${table}`).map((row) => {
          if (table === 'assignments' && schemaVersion < 4) delete row.archived;
          return row;
        }),
        before[table],
      );
    assert.equal(store.get('SELECT active FROM enrollments').active, 1);
    assert.equal(store.snapshot().courses[0].assignments[0].max, 3);
    assert.throws(() => store.run("UPDATE assignment_revisions SET name='Changed'"), /Immutable/);
    if (schemaVersion >= 2) {
      const work = store.snapshot().courses[0].assignments[0].works[0];
      assert.equal(work.authorEventId, 'v');
      assert.equal(work.preparedId, 'copy');
      assert.equal(work.version, 1);
      const p = { profileId: 'p', courseId: 'c', assignmentId: 'a', importId: 'i' };
      assert.equal(store.dispatch('getPreparedCopy', p).id, 'copy');
      const student = store
        .dispatch('addStudent', { profileId: 'p', courseId: 'c', name: 'Other', number: '456' })
        .courses[0].students.find((s) => s.number === '456');
      store.dispatch('changeSubmissionAuthor', {
        ...p,
        studentId: student.id,
        expectedAuthorEventId: 'v',
      });
      assert.equal(store.dispatch('getPreparedCopy', p), null);
      assert.equal(
        store.dispatch('getSubmissionHistory', p).copies[0].invalidReason,
        'Автор работы изменён',
      );
      assert.deepEqual(readFileSync(join(directory, 'files', 'legacy.ipynb')), bytes);
      assert.throws(() => store.run('DELETE FROM submission_versions'), /Immutable/);
      assert.throws(() => store.run("UPDATE prepared_copies SET body='Changed'"), /Immutable/);
      assert.deepEqual(store.get('PRAGMA foreign_key_check'), undefined);
    }
  });
