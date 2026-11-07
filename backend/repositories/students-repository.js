// SQL for students. Transaction boundaries belong to application services.
export function createRepository(db) {
  return {
    findOwned(studentId, profileId) {
      return db.get('SELECT * FROM students WHERE id=? AND profile_id=?', studentId, profileId);
    },
    update(studentId, name, number) {
      return db.run(
        'UPDATE students SET name=?,student_number=? WHERE id=?',
        name,
        number,
        studentId,
      );
    },
    setEnrollmentActive(enrollmentId, active) {
      return db.run('UPDATE enrollments SET active=? WHERE id=?', active, enrollmentId);
    },
    hasCurrentWork(enrollmentId) {
      return Boolean(
        db.get(
          `SELECT a.id FROM current_authors a JOIN submissions sub ON sub.id=a.submission_id
      WHERE sub.enrollment_id=? AND NOT EXISTS(SELECT 1 FROM work_deletions d WHERE d.import_id=a.import_id) LIMIT 1`,
          enrollmentId,
        ),
      );
    },
    listEnrolled(courseId) {
      return db.all(
        'SELECT s.id,s.name,s.student_number AS number FROM students s JOIN enrollments e ON e.student_id=s.id WHERE e.course_id=? AND e.active=1 ORDER BY s.name,s.rowid',
        courseId,
      );
    },
    findByNumber(profileId, number) {
      return db.get(
        'SELECT * FROM students WHERE profile_id=? AND student_number=?',
        profileId,
        number,
      );
    },
    insert(id, profileId, name, number, createdAt) {
      return db.run(
        'INSERT INTO students VALUES (?,?,?,?,?)',
        id,
        profileId,
        name,
        number,
        createdAt,
      );
    },
    findEnrollmentId(courseId, studentId) {
      return db.get(
        'SELECT id FROM enrollments WHERE course_id=? AND student_id=?',
        courseId,
        studentId,
      );
    },
    enroll(id, courseId, studentId) {
      return db.run(
        'INSERT INTO enrollments(id,course_id,student_id) VALUES (?,?,?)',
        id,
        courseId,
        studentId,
      );
    },
    findEnrollment(courseId, studentId) {
      return db.get(
        'SELECT * FROM enrollments WHERE course_id=? AND student_id=? AND active=1',
        courseId,
        studentId,
      );
    },
  };
}
