// Задел для входа через внешнего поставщика (сначала Google).
// Пароль остаётся в auth_methods; внешняя учётная запись хранится отдельно и привязывается к профилю.
// Токены доступа и обновления сюда не записываются: хранится только постоянный идентификатор (sub) и почта для показа.
export function externalIdentitiesSchema(db) {
  db.exec(`
    CREATE TABLE external_identities(
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      provider TEXT NOT NULL CHECK(provider IN ('google')),
      subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 255),
      email TEXT NOT NULL DEFAULT '',
      linked_at TEXT NOT NULL,
      UNIQUE(provider, subject),
      UNIQUE(profile_id, provider)
    ) STRICT;
    CREATE INDEX external_identities_profile ON external_identities(profile_id);
  `);
}
