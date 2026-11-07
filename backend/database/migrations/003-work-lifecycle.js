export function workLifecycleSchema(db) {
  db.exec(`
    ALTER TABLE enrollments ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1));
    CREATE TABLE author_events(
      id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES imports(id),
      submission_id TEXT NOT NULL REFERENCES submissions(id),
      version INTEGER NOT NULL CHECK(version>0),
      previous_id TEXT UNIQUE REFERENCES author_events(id),
      student_name TEXT NOT NULL, student_number TEXT NOT NULL,
      changed_by TEXT NOT NULL REFERENCES profiles(id), created_at TEXT NOT NULL,
      UNIQUE(submission_id,version)
    ) STRICT;
    CREATE INDEX author_events_import ON author_events(import_id);
    CREATE UNIQUE INDEX author_events_root ON author_events(import_id) WHERE previous_id IS NULL;
    INSERT INTO author_events
      SELECT v.id,v.import_id,v.submission_id,v.version,NULL,s.name,s.student_number,s.profile_id,v.created_at
      FROM submission_versions v JOIN submissions sub ON sub.id=v.submission_id
      JOIN enrollments e ON e.id=sub.enrollment_id JOIN students s ON s.id=e.student_id;
    CREATE TABLE copy_author_contexts(
      copy_id TEXT PRIMARY KEY REFERENCES prepared_copies(id),
      author_event_id TEXT NOT NULL REFERENCES author_events(id)
    ) STRICT;
    INSERT INTO copy_author_contexts SELECT id,version_id FROM prepared_copies;
    CREATE TABLE copy_invalidations(
      copy_id TEXT PRIMARY KEY REFERENCES prepared_copies(id), reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE work_deletions(
      import_id TEXT PRIMARY KEY REFERENCES imports(id),
      deleted_by TEXT NOT NULL REFERENCES profiles(id), deleted_at TEXT NOT NULL
    ) STRICT;
    CREATE VIEW current_authors AS
      SELECT a.* FROM author_events a WHERE NOT EXISTS
        (SELECT 1 FROM author_events newer WHERE newer.previous_id=a.id);
  `);
  // История дополняется новыми событиями. Старые триггеры 001/002 остаются на месте.
  for (const table of [
    'author_events',
    'copy_author_contexts',
    'copy_invalidations',
    'work_deletions',
  ]) {
    db.exec(`
      CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table}
        BEGIN SELECT RAISE(ABORT,'Immutable history'); END;
      CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table}
        BEGIN SELECT RAISE(ABORT,'Immutable history'); END;
    `);
  }
}
