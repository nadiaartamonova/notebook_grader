export function createAiRepository(db) {
  return {
    preferences() {
      return db.get('SELECT model,monthly_limit AS monthlyLimit FROM ai_preferences WHERE id=1');
    },
    savePreferences(model, limit) {
      db.run('UPDATE ai_preferences SET model=?,monthly_limit=? WHERE id=1', model, limit);
    },
    spent(start) {
      return db.get(
        "SELECT COALESCE(SUM(estimated_cost),0) AS total FROM check_runs WHERE provider='openai' AND status IN ('completed','failed') AND estimated_cost IS NOT NULL AND finished_at>=?",
        start,
      ).total;
    },
    history(importId, authorId) {
      return db
        .all(
          'SELECT id,provider,model,status,started_at,finished_at,input_tokens,output_tokens,estimated_cost,error,feedback FROM check_runs WHERE import_id=? AND author_event_id=? ORDER BY rowid DESC',
          importId,
          authorId,
        )
        .map((r) => ({
          ...r,
          scores: db.all(
            'SELECT c.name,s.half_points/2.0 AS points,c.half_points/2.0 AS maximum,s.justification FROM check_scores s JOIN criteria c ON c.id=s.criterion_id WHERE run_id=? ORDER BY c.position',
            r.id,
          ),
          findings: db.all(
            'SELECT type,criterion_key,cell,text,recommendation FROM check_findings WHERE run_id=? ORDER BY id',
            r.id,
          ),
        }));
    },
    language(id) {
      return db.get('SELECT language FROM assignment_languages WHERE revision_id=?', id).language;
    },
    addLanguage(id, language) {
      db.run('INSERT INTO assignment_languages VALUES (?,?)', id, language);
    },
    keys(copyId) {
      return db.all(
        'SELECT k.key,k.criterion_id AS id,c.half_points/2.0 AS points FROM copy_criteria k JOIN criteria c ON c.id=k.criterion_id WHERE k.copy_id=? ORDER BY c.position',
        copyId,
      );
    },
    linkKeys(copyId, criteria) {
      criteria.forEach((c, i) =>
        db.run('INSERT INTO copy_criteria VALUES (?,?,?)', copyId, 'C' + (i + 1), c.id),
      );
    },
    reviewed(authorId) {
      return db.get(
        `SELECT p.* FROM prepared_copies p JOIN copy_author_contexts c ON c.copy_id=p.id WHERE c.author_event_id=? AND p.reviewed=1 AND NOT EXISTS(SELECT 1 FROM copy_invalidations x WHERE x.copy_id=p.id) ORDER BY p.revision DESC LIMIT 1`,
        authorId,
      );
    },
    insert(r) {
      db.run(
        `INSERT INTO check_runs(id,import_id,author_event_id,assignment_revision_id,copy_id,provider,model,prompt_version,status,created_at,request_json) VALUES (?,?,?,?,?,?,?,?,'queued',?,?)`,
        r.id,
        r.importId,
        r.authorId,
        r.revisionId,
        r.copyId,
        r.provider ?? 'mock',
        r.model,
        r.promptVersion,
        new Date().toISOString(),
        JSON.stringify(r.request),
      );
    },
    start(id) {
      db.run(
        "UPDATE check_runs SET status='running',started_at=? WHERE id=?",
        new Date().toISOString(),
        id,
      );
    },
    finish(id, status, { text = null, value = null, usage = null, error = null } = {}) {
      db.run(
        'UPDATE check_runs SET status=?,finished_at=?,response_text=?,feedback=?,input_tokens=?,output_tokens=?,estimated_cost=?,error=? WHERE id=?',
        status,
        new Date().toISOString(),
        text,
        value?.feedback ?? null,
        usage?.inputTokens ?? null,
        usage?.outputTokens ?? null,
        usage?.estimatedCost ?? null,
        error,
        id,
      );
    },
    results(id, value, criteria) {
      for (const s of value.scores)
        db.run(
          'INSERT INTO check_scores VALUES (?,?,?,?)',
          id,
          criteria.find((c) => c.key === s.criterion).id,
          s.points * 2,
          s.justification,
        );
      for (const f of value.findings)
        db.run(
          'INSERT INTO check_findings(run_id,type,criterion_key,cell,text,recommendation) VALUES (?,?,?,?,?,?)',
          id,
          f.type,
          f.criterion,
          f.cell,
          f.text,
          f.recommendation,
        );
    },
    get(id) {
      return db.get('SELECT * FROM check_runs WHERE id=?', id);
    },
    recover() {
      db.run(
        "UPDATE check_runs SET status='interrupted',finished_at=?,error='Проверка прервана перезапуском приложения.' WHERE status IN ('queued','running')",
        new Date().toISOString(),
      );
    },
  };
}
