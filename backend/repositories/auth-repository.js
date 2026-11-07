export function createAuthRepository(db) {
  return {
    find(profileId) {
      return db.get("SELECT * FROM auth_methods WHERE profile_id=? AND type='password'", profileId);
    },
    save(profileId, password, recovery, parameters, createdAt) {
      return db.run(
        `INSERT INTO auth_methods VALUES (?,'password',?,?,?,?,?,?)
        ON CONFLICT(profile_id,type) DO UPDATE SET password_hash=excluded.password_hash,
        password_salt=excluded.password_salt,parameters=excluded.parameters,recovery_hash=excluded.recovery_hash,
        recovery_salt=excluded.recovery_salt,updated_at=excluded.updated_at`,
        profileId,
        password.hash,
        password.salt,
        JSON.stringify(parameters),
        recovery.hash,
        recovery.salt,
        createdAt,
      );
    },
  };
}
