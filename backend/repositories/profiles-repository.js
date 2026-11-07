// SQL for profiles. Transaction boundaries belong to application services.
export function createRepository(db) {
  return {
    find(profileId) {
      return db.get('SELECT id FROM profiles WHERE id=?', profileId);
    },
    list() {
      return db.all(
        `SELECT p.id,p.name,NOT EXISTS(SELECT 1 FROM auth_methods a WHERE a.profile_id=p.id AND a.type='password') AS needsPassword FROM profiles p ORDER BY p.created_at,p.rowid`,
      );
    },
    insert(id, name, createdAt) {
      return db.run('INSERT INTO profiles VALUES (?,?,?)', id, name, createdAt);
    },
  };
}
