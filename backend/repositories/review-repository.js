export function createReviewRepository(db) {
  return {
    latest(eventId, approved = false) {
      return db.get(
        `SELECT * FROM teacher_reviews WHERE author_event_id=?
      ${approved ? "AND status='approved'" : ''} ORDER BY revision DESC LIMIT 1`,
        eventId,
      );
    },
    scores(reviewId) {
      return db.all(
        'SELECT criterion_id AS criterionId,half_points AS halfPoints,comment FROM review_scores WHERE review_id=?',
        reviewId,
      );
    },
    insert(review) {
      return db.run(
        'INSERT INTO teacher_reviews VALUES (?,?,?,?,?,?,?,?,?,?)',
        review.id,
        review.importId,
        review.eventId,
        review.assignmentRevisionId,
        review.revision,
        review.previousId,
        review.status,
        review.feedback,
        review.profileId,
        review.createdAt,
      );
    },
    insertScore(reviewId, score) {
      return db.run(
        'INSERT INTO review_scores VALUES (?,?,?,?)',
        reviewId,
        score.criterionId,
        score.halfPoints,
        score.comment,
      );
    },
    history(eventId) {
      return db.all(
        'SELECT id,revision,status,created_at AS createdAt,previous_id AS previousId FROM teacher_reviews WHERE author_event_id=? ORDER BY revision',
        eventId,
      );
    },
  };
}
