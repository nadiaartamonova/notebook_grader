// SQL for courses. Transaction boundaries belong to application services.
export function createRepository(db) {
  return {
    findOwned(courseId, profileId) {
      return db.get('SELECT * FROM courses WHERE id=? AND profile_id=?', courseId, profileId);
    },
    latestRules(courseId) {
      return db.get(
        'SELECT * FROM rule_revisions WHERE course_id=? ORDER BY version DESC LIMIT 1',
        courseId,
      );
    },
    insertRules(id, courseId, version, content, createdAt) {
      return db.run(
        'INSERT INTO rule_revisions VALUES (?,?,?,?,?)',
        id,
        courseId,
        version,
        content,
        createdAt,
      );
    },
    insert(id, profileId, name, group, year, semester, mode, sourceId, createdAt) {
      return db.run(
        'INSERT INTO courses VALUES (?,?,?,?,?,?,?,?,?)',
        id,
        profileId,
        name,
        group,
        year,
        semester,
        mode,
        sourceId,
        createdAt,
      );
    },
    listOwned(profileId) {
      return db.all(
        'SELECT * FROM courses WHERE profile_id=? ORDER BY created_at,rowid',
        profileId,
      );
    },
    findRules(revisionId) {
      return db.get('SELECT content FROM rule_revisions WHERE id=?', revisionId);
    },
  };
}
