export function teacherReviewSchema(db) {
  db.exec(`
    CREATE TABLE teacher_reviews(
      id TEXT PRIMARY KEY,import_id TEXT NOT NULL REFERENCES imports(id),
      author_event_id TEXT NOT NULL REFERENCES author_events(id),
      assignment_revision_id TEXT NOT NULL REFERENCES assignment_revisions(id),
      revision INTEGER NOT NULL,previous_id TEXT UNIQUE REFERENCES teacher_reviews(id),
      status TEXT NOT NULL CHECK(status IN ('draft','approved')),feedback TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES profiles(id),created_at TEXT NOT NULL,
      UNIQUE(author_event_id,revision)
    ) STRICT;
    CREATE TABLE review_scores(
      review_id TEXT NOT NULL REFERENCES teacher_reviews(id),criterion_id TEXT NOT NULL REFERENCES criteria(id),
      half_points INTEGER CHECK(half_points IS NULL OR half_points>=0),comment TEXT NOT NULL,
      PRIMARY KEY(review_id,criterion_id)
    ) STRICT;
    CREATE TRIGGER review_score_valid BEFORE INSERT ON review_scores BEGIN
      SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM teacher_reviews r JOIN criteria c ON c.revision_id=r.assignment_revision_id
        WHERE r.id=NEW.review_id AND c.id=NEW.criterion_id AND (NEW.half_points IS NULL OR NEW.half_points<=c.half_points)
        AND (r.status='draft' OR NEW.half_points IS NOT NULL)) THEN RAISE(ABORT,'Invalid review score') END;
    END;
  `);
  // Сохранение черновика тоже создаёт снимок. Утверждённое решение никогда не переписывается.
  for (const table of ['teacher_reviews', 'review_scores'])
    db.exec(`
    CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable review'); END;
    CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable review'); END;
  `);
}
