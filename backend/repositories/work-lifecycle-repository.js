export function createLifecycleRepository(db) {
  return {
    findImport(importId, assignmentId) {
      return db.get(
        `SELECT i.* FROM imports i WHERE i.id=? AND i.assignment_id=?
        AND NOT EXISTS (SELECT 1 FROM work_deletions d WHERE d.import_id=i.id)`,
        importId,
        assignmentId,
      );
    },
    listWorks(assignmentId) {
      return db.all(
        `SELECT i.id AS importId,i.original_name AS file,i.status,i.error,
        i.cell_count AS cells,i.created_at AS createdAt,v.id AS versionId,a.version,
        a.id AS authorEventId,s.id AS studentId,s.name AS studentName,s.student_number AS studentNumber,
        p.id AS preparedId,p.reviewed
        FROM imports i LEFT JOIN submission_versions v ON v.import_id=i.id
        LEFT JOIN current_authors a ON a.import_id=i.id
        LEFT JOIN submissions sub ON sub.id=a.submission_id
        LEFT JOIN enrollments e ON e.id=sub.enrollment_id LEFT JOIN students s ON s.id=e.student_id
        LEFT JOIN prepared_copies p ON p.id=(SELECT pc.id FROM prepared_copies pc
          JOIN copy_author_contexts ctx ON ctx.copy_id=pc.id WHERE ctx.author_event_id=a.id
          AND NOT EXISTS (SELECT 1 FROM copy_invalidations x WHERE x.copy_id=pc.id)
          ORDER BY pc.revision DESC LIMIT 1)
        WHERE i.assignment_id=? AND NOT EXISTS (SELECT 1 FROM work_deletions d WHERE d.import_id=i.id)
        ORDER BY i.created_at DESC,i.rowid DESC`,
        assignmentId,
      );
    },
    currentAuthor(importId) {
      return db.get(
        `SELECT a.*,e.student_id,e.id AS enrollment_id FROM current_authors a
        JOIN submissions sub ON sub.id=a.submission_id JOIN enrollments e ON e.id=sub.enrollment_id
        WHERE a.import_id=?`,
        importId,
      );
    },
    countVersions(submissionId) {
      return db.get(
        'SELECT COALESCE(MAX(version),0) AS n FROM author_events WHERE submission_id=?',
        submissionId,
      );
    },
    insertAuthorEvent(event) {
      return db.run(
        'INSERT INTO author_events VALUES (?,?,?,?,?,?,?,?,?)',
        event.id,
        event.importId,
        event.submissionId,
        event.version,
        event.previousId,
        event.name,
        event.number,
        event.profileId,
        event.createdAt,
      );
    },
    invalidateCopies(importId, reason, createdAt) {
      return db.run(
        `INSERT INTO copy_invalidations
        SELECT p.id,?,? FROM prepared_copies p JOIN submission_versions v ON v.id=p.version_id
        WHERE v.import_id=? AND NOT EXISTS (SELECT 1 FROM copy_invalidations x WHERE x.copy_id=p.id)`,
        reason,
        createdAt,
        importId,
      );
    },
    deleteWork(importId, profileId, createdAt) {
      return db.run('INSERT INTO work_deletions VALUES (?,?,?)', importId, profileId, createdAt);
    },
    findAuthorVersion(importId) {
      return db.get(
        `SELECT v.id,a.id AS authorEventId,s.name,s.student_number
        FROM submission_versions v JOIN current_authors a ON a.import_id=v.import_id
        JOIN submissions sub ON sub.id=a.submission_id JOIN enrollments e ON e.id=sub.enrollment_id
        JOIN students s ON s.id=e.student_id WHERE v.import_id=?`,
        importId,
      );
    },
    latestCopy(authorEventId) {
      return db.get(
        `SELECT p.* FROM prepared_copies p JOIN copy_author_contexts c ON c.copy_id=p.id
        WHERE c.author_event_id=? AND NOT EXISTS(SELECT 1 FROM copy_invalidations x WHERE x.copy_id=p.id)
        ORDER BY p.revision DESC LIMIT 1`,
        authorEventId,
      );
    },
    nextCopyRevision(versionId) {
      return db.get(
        'SELECT COALESCE(MAX(revision),0)+1 AS n FROM prepared_copies WHERE version_id=?',
        versionId,
      ).n;
    },
    linkCopy(copyId, authorEventId) {
      return db.run('INSERT INTO copy_author_contexts VALUES (?,?)', copyId, authorEventId);
    },
    authorHistory(importId) {
      return db.all(
        `SELECT a.id,a.previous_id AS previousId,a.student_name AS name,
        a.student_number AS number,a.version,a.created_at AS createdAt,p.name AS changedBy,
        CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS current
        FROM author_events a JOIN profiles p ON p.id=a.changed_by
        LEFT JOIN current_authors c ON c.id=a.id WHERE a.import_id=? ORDER BY a.rowid`,
        importId,
      );
    },
    copyHistory(importId) {
      return db.all(
        `SELECT p.id,p.revision,p.created_at AS createdAt,a.student_name AS name,
        x.reason AS invalidReason,x.created_at AS invalidatedAt FROM prepared_copies p
        JOIN submission_versions v ON v.id=p.version_id JOIN copy_author_contexts c ON c.copy_id=p.id
        JOIN author_events a ON a.id=c.author_event_id LEFT JOIN copy_invalidations x ON x.copy_id=p.id
        WHERE v.import_id=? ORDER BY p.revision`,
        importId,
      );
    },
  };
}
