export function submissionSchema(db) {
  db.exec(`
    CREATE TABLE imports(
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
      assignment_revision_id TEXT NOT NULL REFERENCES assignment_revisions(id),
      original_name TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL,
      byte_size INTEGER NOT NULL, cell_count INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','ready','error')), error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE submissions(
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
      enrollment_id TEXT NOT NULL REFERENCES enrollments(id), UNIQUE(assignment_id,enrollment_id)
    ) STRICT;
    CREATE TABLE submission_versions(
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id),
      version INTEGER NOT NULL, import_id TEXT NOT NULL UNIQUE REFERENCES imports(id),
      created_at TEXT NOT NULL, UNIQUE(submission_id,version)
    ) STRICT;
    CREATE TABLE prepared_copies(
      id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES submission_versions(id),
      revision INTEGER NOT NULL, request_id TEXT NOT NULL, body TEXT NOT NULL,
      findings TEXT NOT NULL, reviewed INTEGER NOT NULL CHECK(reviewed IN (0,1)),
      created_at TEXT NOT NULL, UNIQUE(version_id, revision)
    ) STRICT;
    CREATE INDEX imports_assignment ON imports(assignment_id);
    CREATE TRIGGER submission_version_no_update BEFORE UPDATE ON submission_versions BEGIN SELECT RAISE(ABORT,'Immutable submission'); END;
    CREATE TRIGGER submission_version_no_delete BEFORE DELETE ON submission_versions BEGIN SELECT RAISE(ABORT,'Immutable submission'); END;
    CREATE TRIGGER prepared_no_update BEFORE UPDATE ON prepared_copies BEGIN SELECT RAISE(ABORT,'Immutable prepared copy'); END;
    CREATE TRIGGER prepared_no_delete BEFORE DELETE ON prepared_copies BEGIN SELECT RAISE(ABORT,'Immutable prepared copy'); END;
  `);
}
