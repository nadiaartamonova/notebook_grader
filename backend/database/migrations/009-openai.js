// Пересоздаём только таблицы запусков и их дочерние таблицы: меняется CHECK поставщика.
// Внешние ключи не отключаются; всё выполняется транзакцией мигратора.
export function openAiSchema(db) {
  const tables = ['check_runs', 'check_scores', 'check_findings'];
  const saved = tables.map((name) => ({
    name,
    sql: db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name).sql,
    rows: db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all(),
  }));
  const triggers = db
    .prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'")
    .all()
    .filter((t) => /\b(check_runs|check_scores|check_findings)\b/.test(t.sql));
  for (const trigger of triggers) db.exec(`DROP TRIGGER "${trigger.name}"`);
  db.exec('DROP TABLE check_findings; DROP TABLE check_scores; DROP TABLE check_runs;');
  for (const table of saved) {
    const sql =
      table.name === 'check_runs'
        ? table.sql.replace("CHECK(provider='mock')", "CHECK(provider IN ('mock','openai'))")
        : table.sql;
    if (table.name === 'check_runs' && sql === table.sql)
      throw new Error('Неожиданная схема поставщика');
    db.exec(sql);
    for (const row of table.rows) {
      const keys = Object.keys(row);
      db.prepare(
        `INSERT INTO ${table.name} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
      ).run(...Object.values(row));
    }
  }
  for (const trigger of triggers) db.exec(trigger.sql);
  db.exec(`CREATE TABLE ai_preferences(id INTEGER PRIMARY KEY CHECK(id=1),model TEXT NOT NULL,monthly_limit REAL NOT NULL CHECK(monthly_limit>=0)) STRICT;
    INSERT INTO ai_preferences VALUES (1,'gpt-6.1-sol',5);`);
}
