export function workspaceSchema(db) {
  db.exec(`
        CREATE TABLE profiles(id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
        CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT) STRICT;
        CREATE TABLE courses(
          id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id),
          name TEXT NOT NULL, group_name TEXT NOT NULL, year INTEGER NOT NULL CHECK(year BETWEEN 2000 AND 2100),
          semester TEXT NOT NULL CHECK(semester IN ('Весна','Осень')),
          mode TEXT NOT NULL CHECK(mode IN ('Дневное','Сессионное')),
          source_id TEXT REFERENCES courses(id), created_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE rule_revisions(
          id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id),
          version INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL,
          UNIQUE(course_id, version)
        ) STRICT;
        CREATE TABLE students(
          id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id),
          name TEXT NOT NULL, student_number TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
        ) STRICT;
        CREATE UNIQUE INDEX student_number_unique ON students(profile_id, student_number) WHERE student_number != '';
        CREATE TABLE enrollments(
          id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id),
          student_id TEXT NOT NULL REFERENCES students(id), UNIQUE(course_id,student_id)
        ) STRICT;
        CREATE TABLE assignments(
          id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id), created_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE assignment_revisions(
          id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
          version INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
          additional TEXT NOT NULL, rule_revision_id TEXT NOT NULL REFERENCES rule_revisions(id),
          created_at TEXT NOT NULL, UNIQUE(assignment_id,version)
        ) STRICT;
        CREATE TABLE criteria(
          id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES assignment_revisions(id),
          position INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
          half_points INTEGER NOT NULL CHECK(half_points BETWEEN 1 AND 2000),
          UNIQUE(revision_id, position)
        ) STRICT;
        CREATE INDEX courses_owner ON courses(profile_id);
        CREATE INDEX assignments_course ON assignments(course_id);
        CREATE TRIGGER rules_no_update BEFORE UPDATE ON rule_revisions BEGIN SELECT RAISE(ABORT,'Immutable rules'); END;
        CREATE TRIGGER rules_no_delete BEFORE DELETE ON rule_revisions BEGIN SELECT RAISE(ABORT,'Immutable rules'); END;
        CREATE TRIGGER revision_no_update BEFORE UPDATE ON assignment_revisions BEGIN SELECT RAISE(ABORT,'Immutable revision'); END;
        CREATE TRIGGER revision_no_delete BEFORE DELETE ON assignment_revisions BEGIN SELECT RAISE(ABORT,'Immutable revision'); END;
        CREATE TRIGGER criteria_no_update BEFORE UPDATE ON criteria BEGIN SELECT RAISE(ABORT,'Immutable criteria'); END;
        CREATE TRIGGER criteria_no_delete BEFORE DELETE ON criteria BEGIN SELECT RAISE(ABORT,'Immutable criteria'); END;

      `);
}
