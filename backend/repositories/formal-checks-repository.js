export function createFormalChecksRepository(db) {
  return {
    settings(revisionId) {
      return JSON.parse(
        db.get('SELECT settings_json FROM formal_check_settings WHERE revision_id=?', revisionId)
          .settings_json,
      );
    },
    insertSettings(revisionId, settings) {
      db.run(
        'INSERT INTO formal_check_settings VALUES (?,?)',
        revisionId,
        JSON.stringify(settings),
      );
    },
    insert(run) {
      db.run(
        'INSERT INTO formal_check_runs VALUES (?,?,?,?,?,?,?)',
        run.id,
        run.importId,
        run.assignmentRevisionId,
        run.authorEventId,
        run.createdAt,
        1,
        JSON.stringify(run.results),
      );
    },
    history(importId, authorId) {
      return db
        .all(
          'SELECT id,assignment_revision_id AS assignmentRevisionId,created_at AS createdAt,results_json FROM formal_check_runs WHERE import_id=? AND author_event_id=? ORDER BY rowid DESC',
          importId,
          authorId,
        )
        .map(({ results_json, ...row }) => ({ ...row, results: JSON.parse(results_json) }));
    },
  };
}
