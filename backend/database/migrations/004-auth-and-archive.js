export function authAndArchiveSchema(db) {
  db.exec(`
    CREATE TABLE auth_methods(
      profile_id TEXT NOT NULL REFERENCES profiles(id), type TEXT NOT NULL,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, parameters TEXT NOT NULL,
      recovery_hash TEXT NOT NULL, recovery_salt TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(profile_id,type)
    ) STRICT;
    DELETE FROM settings WHERE key='active';
    ALTER TABLE assignments ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1));
  `);
}
