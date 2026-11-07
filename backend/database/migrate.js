// Every migration runs atomically. Add new migrations at the end; never rewrite a released one.
export function migrate(db, migrations) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  if (current > migrations.length) throw new Error('База создана более новой версией приложения.');
  for (let index = current; index < migrations.length; index++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      migrations[index](db);
      db.exec(`PRAGMA user_version=${index + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
