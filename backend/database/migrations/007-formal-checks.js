// Значения по умолчанию зафиксированы здесь, а не импортируются из backend/checks:
// выпущенная миграция должна давать одинаковый результат, даже если настройки по умолчанию позже изменятся.
const MIGRATION_007_DEFAULTS = {
  enabled: {
    filename: true,
    firstCell: true,
    identity: true,
    tasks: true,
    aiForm: true,
    syntax: true,
  },
  filenamePattern: '',
  taskCount: 1,
  aiKeywords: 'AI kasutamise vorm',
};
export function formalChecksSchema(db) {
  db.exec(`
    CREATE TABLE formal_check_settings(
      revision_id TEXT PRIMARY KEY REFERENCES assignment_revisions(id),
      settings_json TEXT NOT NULL CHECK(json_valid(settings_json))
    ) STRICT;
    CREATE TABLE formal_check_runs(
      id TEXT PRIMARY KEY,
      import_id TEXT NOT NULL REFERENCES imports(id),
      assignment_revision_id TEXT NOT NULL REFERENCES assignment_revisions(id),
      author_event_id TEXT NOT NULL REFERENCES author_events(id),
      created_at TEXT NOT NULL,
      checker_version INTEGER NOT NULL,
      results_json TEXT NOT NULL CHECK(json_valid(results_json))
    ) STRICT;
    CREATE INDEX formal_runs_import ON formal_check_runs(import_id, author_event_id);
    CREATE TRIGGER formal_run_context BEFORE INSERT ON formal_check_runs BEGIN
      SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM imports i JOIN current_authors a ON a.import_id=i.id
        WHERE i.id=NEW.import_id AND i.assignment_revision_id=NEW.assignment_revision_id
          AND a.id=NEW.author_event_id AND i.status='ready'
          AND NOT EXISTS(SELECT 1 FROM work_deletions d WHERE d.import_id=i.id)
      ) THEN RAISE(ABORT,'Invalid formal check context') END;
    END;
  `);
  const insert = db.prepare('INSERT INTO formal_check_settings VALUES (?,?)');
  for (const row of db.prepare('SELECT id FROM assignment_revisions').all())
    insert.run(row.id, JSON.stringify(MIGRATION_007_DEFAULTS));
  for (const table of ['formal_check_settings', 'formal_check_runs'])
    for (const operation of ['UPDATE', 'DELETE'])
      db.exec(
        `CREATE TRIGGER ${table}_${operation.toLowerCase()} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable formal check history'); END;`,
      );
}
