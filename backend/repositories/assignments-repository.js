// SQL for assignments. Transaction boundaries belong to application services.
export function createRepository(db) {
  return {
    setArchived(assignmentId, archived) {
      return db.run('UPDATE assignments SET archived=? WHERE id=?', archived, assignmentId);
    },
    maxVersion(assignmentId) {
      return db.get(
        'SELECT MAX(version) AS version FROM assignment_revisions WHERE assignment_id=?',
        assignmentId,
      );
    },
    insertRevision(id, assignmentId, version, name, description, additional, rulesId, createdAt) {
      return db.run(
        'INSERT INTO assignment_revisions VALUES (?,?,?,?,?,?,?,?)',
        id,
        assignmentId,
        version,
        name,
        description,
        additional,
        rulesId,
        createdAt,
      );
    },
    insertCriterion(id, revisionId, position, name, description, halfPoints) {
      return db.run(
        'INSERT INTO criteria VALUES (?,?,?,?,?,?)',
        id,
        revisionId,
        position,
        name,
        description,
        halfPoints,
      );
    },
    listLatest(courseId) {
      return db.all(
        'SELECT a.id,a.archived,r.id AS revision_id,r.version,r.name,r.description,r.additional,r.rule_revision_id\n      FROM assignments a JOIN assignment_revisions r ON r.assignment_id=a.id\n      WHERE a.course_id=? AND r.version=(SELECT MAX(version) FROM assignment_revisions WHERE assignment_id=a.id)\n      ORDER BY a.created_at,a.rowid',
        courseId,
      );
    },
    listCriteria(revisionId) {
      return db.all(
        'SELECT id,name,description,half_points FROM criteria WHERE revision_id=? ORDER BY position',
        revisionId,
      );
    },
    insert(id, courseId, createdAt) {
      return db.run(
        'INSERT INTO assignments(id,course_id,created_at) VALUES (?,?,?)',
        id,
        courseId,
        createdAt,
      );
    },
    findInCourse(assignmentId, courseId) {
      return db.get(
        'SELECT id FROM assignments WHERE id=? AND course_id=?',
        assignmentId,
        courseId,
      );
    },
    latestRevisionId(assignmentId) {
      return db.get(
        'SELECT id FROM assignment_revisions WHERE assignment_id=? ORDER BY version DESC LIMIT 1',
        assignmentId,
      );
    },
    findRevision(revisionId) {
      return db.get('SELECT * FROM assignment_revisions WHERE id=?', revisionId);
    },
    listCriterionValues(revisionId) {
      return db.all(
        'SELECT name,description,half_points FROM criteria WHERE revision_id=? ORDER BY position',
        revisionId,
      );
    },
  };
}
