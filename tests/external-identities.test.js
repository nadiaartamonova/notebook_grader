import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../backend/database/migrate.js';
import { workspaceSchema } from '../backend/database/migrations/001-workspace.js';
import { submissionSchema } from '../backend/database/migrations/002-submissions.js';
import { workLifecycleSchema } from '../backend/database/migrations/003-work-lifecycle.js';
import { authAndArchiveSchema } from '../backend/database/migrations/004-auth-and-archive.js';
import { teacherReviewSchema } from '../backend/database/migrations/005-teacher-reviews.js';
import { Store } from '../backend/store.js';

test('migration 5 to 6 keeps password login data and adds unique external identities', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'practicum-external-'));
  let store;
  t.after(() => {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const db = new DatabaseSync(join(directory, 'practicum.sqlite3'));
  db.exec('PRAGMA foreign_keys=ON');
  migrate(db, [
    workspaceSchema,
    submissionSchema,
    workLifecycleSchema,
    authAndArchiveSchema,
    teacherReviewSchema,
  ]);
  db.exec(`
    INSERT INTO profiles VALUES ('p','Учитель','2026-01-01');
    INSERT INTO profiles VALUES ('q','Второй','2026-01-01');
    INSERT INTO auth_methods VALUES ('p','password','h','s','{}','rh','rs','2026-01-01');
  `);
  db.close();

  store = new Store(directory);
  assert.equal(store.get('PRAGMA user_version').user_version, 6);
  assert.equal(
    store.get('SELECT password_hash FROM auth_methods WHERE profile_id=?', 'p').password_hash,
    'h',
  );

  store.run(
    "INSERT INTO external_identities VALUES ('x','p','google','sub-1','a@example.com','2026-01-02')",
  );
  // Одна учётная запись Google — один профиль; у профиля не больше одной привязки Google.
  assert.throws(() =>
    store.run("INSERT INTO external_identities VALUES ('y','q','google','sub-1','','2026-01-02')"),
  );
  assert.throws(() =>
    store.run("INSERT INTO external_identities VALUES ('z','p','google','sub-2','','2026-01-02')"),
  );
  assert.throws(() =>
    store.run(
      "INSERT INTO external_identities VALUES ('w','q','facebook','sub-3','','2026-01-02')",
    ),
  );
  assert.throws(() =>
    store.run(
      "INSERT INTO external_identities VALUES ('v','missing','google','sub-4','','2026-01-02')",
    ),
  );
});
