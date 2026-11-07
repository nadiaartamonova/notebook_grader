import { teacherReviewSchema } from './migrations/005-teacher-reviews.js';
import { authAndArchiveSchema } from './migrations/004-auth-and-archive.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from './migrate.js';
import { workspaceSchema } from './migrations/001-workspace.js';
import { submissionSchema } from './migrations/002-submissions.js';
import { workLifecycleSchema } from './migrations/003-work-lifecycle.js';
export class Connection {
  constructor(directory) {
    mkdirSync(directory, { recursive: true });
    this.db = new DatabaseSync(join(directory, 'practicum.sqlite3'));
    try {
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
      migrate(this.db, [
        workspaceSchema,
        submissionSchema,
        workLifecycleSchema,
        authAndArchiveSchema,
        teacherReviewSchema,
      ]);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  all(sql, ...args) {
    return this.db.prepare(sql).all(...args);
  }
  get(sql, ...args) {
    return this.db.prepare(sql).get(...args);
  }
  run(sql, ...args) {
    return this.db.prepare(sql).run(...args);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
