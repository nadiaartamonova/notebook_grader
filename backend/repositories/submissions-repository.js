import { createLifecycleRepository } from './work-lifecycle-repository.js';
// SQL for submissions. Transaction boundaries belong to application services.
export function createRepository(db) {
  return {
    ...createLifecycleRepository(db),
    listPending() {
      return db.all(`SELECT i.* FROM imports i WHERE i.status='pending'
        AND NOT EXISTS (SELECT 1 FROM work_deletions d WHERE d.import_id=i.id)`);
    },
    markRecovered(importId) {
      return db.run("UPDATE imports SET status='ready',error='' WHERE id=?", importId);
    },
    markFailed(error, importId) {
      return db.run("UPDATE imports SET status='error',error=? WHERE id=?", error, importId);
    },
    findAssignedVersion(importId) {
      return db.get('SELECT id FROM submission_versions WHERE import_id=?', importId);
    },
    findSubmission(assignmentId, enrollmentId) {
      return db.get(
        'SELECT id FROM submissions WHERE assignment_id=? AND enrollment_id=?',
        assignmentId,
        enrollmentId,
      );
    },
    insertSubmission(id, assignmentId, enrollmentId) {
      return db.run('INSERT INTO submissions VALUES (?,?,?)', id, assignmentId, enrollmentId);
    },
    insertVersion(id, submissionId, version, importId, createdAt) {
      return db.run(
        'INSERT INTO submission_versions VALUES (?,?,?,?,?)',
        id,
        submissionId,
        version,
        importId,
        createdAt,
      );
    },
    insertImport(
      id,
      assignmentId,
      revisionId,
      name,
      key,
      sha256,
      size,
      cells,
      status,
      error,
      createdAt,
    ) {
      return db.run(
        'INSERT INTO imports VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        id,
        assignmentId,
        revisionId,
        name,
        key,
        sha256,
        size,
        cells,
        status,
        error,
        createdAt,
      );
    },
    markReady(importId) {
      return db.run("UPDATE imports SET status='ready' WHERE id=?", importId);
    },
    insertCopy(id, versionId, revision, requestId, body, findings, reviewed, createdAt) {
      return db.run(
        'INSERT INTO prepared_copies VALUES (?,?,?,?,?,?,?,?)',
        id,
        versionId,
        revision,
        requestId,
        body,
        findings,
        reviewed,
        createdAt,
      );
    },
  };
}
