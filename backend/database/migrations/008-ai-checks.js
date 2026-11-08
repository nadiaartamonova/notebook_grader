// Самостоятельная миграция: выпущенные значения не зависят от рабочего кода.
export function aiChecksSchema(db) {
  db.exec(`
    CREATE TABLE assignment_languages(revision_id TEXT PRIMARY KEY REFERENCES assignment_revisions(id), language TEXT NOT NULL) STRICT;
    INSERT INTO assignment_languages SELECT id,'эстонский' FROM assignment_revisions;
    CREATE TABLE copy_criteria(copy_id TEXT NOT NULL REFERENCES prepared_copies(id), key TEXT NOT NULL, criterion_id TEXT NOT NULL REFERENCES criteria(id), PRIMARY KEY(copy_id,key), UNIQUE(copy_id,criterion_id)) STRICT;
    CREATE TABLE check_runs(
      id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES imports(id),
      author_event_id TEXT NOT NULL REFERENCES author_events(id),
      assignment_revision_id TEXT NOT NULL REFERENCES assignment_revisions(id),
      copy_id TEXT NOT NULL REFERENCES prepared_copies(id),
      provider TEXT NOT NULL CHECK(provider='mock'), model TEXT NOT NULL, prompt_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed','interrupted')),
      created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT,
      input_tokens INTEGER CHECK(input_tokens>=0), output_tokens INTEGER CHECK(output_tokens>=0),
      estimated_cost REAL CHECK(estimated_cost>=0), error TEXT,
      request_json TEXT NOT NULL CHECK(json_valid(request_json)), response_text TEXT, feedback TEXT,
      CHECK((status IN ('queued','running') AND finished_at IS NULL) OR (status IN ('completed','failed','interrupted') AND finished_at IS NOT NULL)),
      CHECK(status!='running' OR started_at IS NOT NULL),
      CHECK(status!='completed' OR (response_text IS NOT NULL AND feedback IS NOT NULL))
    ) STRICT;
    CREATE TABLE check_scores(run_id TEXT NOT NULL REFERENCES check_runs(id), criterion_id TEXT NOT NULL REFERENCES criteria(id), half_points INTEGER NOT NULL CHECK(half_points>=0), justification TEXT NOT NULL, PRIMARY KEY(run_id,criterion_id)) STRICT;
    CREATE TABLE check_findings(id INTEGER PRIMARY KEY, run_id TEXT NOT NULL REFERENCES check_runs(id), type TEXT NOT NULL CHECK(type IN ('violation','recommendation','assumption')), criterion_key TEXT, cell INTEGER CHECK(cell>0), text TEXT NOT NULL, recommendation TEXT NOT NULL) STRICT;
    CREATE TRIGGER check_run_insert BEFORE INSERT ON check_runs BEGIN
      SELECT CASE WHEN NEW.status!='queued' OR NOT EXISTS(
        SELECT 1 FROM imports i JOIN current_authors a ON a.import_id=i.id
        JOIN copy_author_contexts c ON c.author_event_id=a.id JOIN prepared_copies p ON p.id=c.copy_id
        WHERE i.id=NEW.import_id AND a.id=NEW.author_event_id AND i.assignment_revision_id=NEW.assignment_revision_id
          AND p.id=NEW.copy_id AND p.reviewed=1 AND i.status='ready'
          AND NOT EXISTS(SELECT 1 FROM work_deletions d WHERE d.import_id=i.id)
          AND NOT EXISTS(SELECT 1 FROM copy_invalidations x WHERE x.copy_id=p.id)
      ) THEN RAISE(ABORT,'Invalid AI run context') END;
    END;
    CREATE TRIGGER copy_criterion_insert BEFORE INSERT ON copy_criteria BEGIN
      SELECT CASE WHEN EXISTS(SELECT 1 FROM check_runs WHERE copy_id=NEW.copy_id) OR NOT EXISTS(
        SELECT 1 FROM prepared_copies p JOIN submission_versions v ON v.id=p.version_id
        JOIN imports i ON i.id=v.import_id JOIN criteria c ON c.revision_id=i.assignment_revision_id
        WHERE p.id=NEW.copy_id AND c.id=NEW.criterion_id AND NEW.key='C'||(c.position+1)
      ) THEN RAISE(ABORT,'Invalid copy criterion') END;
    END;
    CREATE TRIGGER check_run_update BEFORE UPDATE ON check_runs BEGIN
      SELECT CASE WHEN OLD.status IN ('completed','failed','interrupted') THEN RAISE(ABORT,'Immutable AI run') END;
      SELECT CASE WHEN NOT ((OLD.status='queued' AND NEW.status IN ('running','interrupted')) OR (OLD.status='running' AND NEW.status IN ('completed','failed','interrupted'))) THEN RAISE(ABORT,'Invalid AI state transition') END;
      SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.import_id IS NOT OLD.import_id OR NEW.author_event_id IS NOT OLD.author_event_id OR NEW.assignment_revision_id IS NOT OLD.assignment_revision_id OR NEW.copy_id IS NOT OLD.copy_id OR NEW.request_json IS NOT OLD.request_json OR NEW.provider IS NOT OLD.provider OR NEW.model IS NOT OLD.model OR NEW.prompt_version IS NOT OLD.prompt_version OR NEW.created_at IS NOT OLD.created_at THEN RAISE(ABORT,'Immutable AI request') END;
      SELECT CASE WHEN NEW.status='completed' AND (SELECT COUNT(*) FROM check_scores WHERE run_id=NEW.id)!=(SELECT COUNT(*) FROM copy_criteria WHERE copy_id=NEW.copy_id) THEN RAISE(ABORT,'Incomplete AI scores') END;
      SELECT CASE WHEN NEW.status IN ('failed','interrupted') AND (EXISTS(SELECT 1 FROM check_scores WHERE run_id=NEW.id) OR EXISTS(SELECT 1 FROM check_findings WHERE run_id=NEW.id)) THEN RAISE(ABORT,'Partial AI results') END;
    END;
    CREATE TRIGGER check_run_delete BEFORE DELETE ON check_runs BEGIN SELECT RAISE(ABORT,'Immutable AI run'); END;
    CREATE TRIGGER check_score_insert BEFORE INSERT ON check_scores BEGIN
      SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM check_runs r JOIN copy_criteria k ON k.copy_id=r.copy_id JOIN criteria c ON c.id=k.criterion_id WHERE r.id=NEW.run_id AND r.status='running' AND c.id=NEW.criterion_id AND c.revision_id=r.assignment_revision_id AND NEW.half_points<=c.half_points) THEN RAISE(ABORT,'Invalid AI score') END;
    END;
    CREATE TRIGGER check_finding_insert BEFORE INSERT ON check_findings BEGIN
      SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM check_runs r WHERE r.id=NEW.run_id AND r.status='running' AND (NEW.criterion_key IS NULL OR EXISTS(SELECT 1 FROM copy_criteria k WHERE k.copy_id=r.copy_id AND k.key=NEW.criterion_key)) AND (NEW.cell IS NULL OR EXISTS(SELECT 1 FROM json_each(r.request_json,'$.input.cells') c WHERE json_extract(c.value,'$.number')=NEW.cell))) THEN RAISE(ABORT,'Invalid AI finding') END;
    END;
  `);
  for (const table of ['assignment_languages', 'copy_criteria', 'check_scores', 'check_findings'])
    for (const operation of ['UPDATE', 'DELETE'])
      db.exec(
        `CREATE TRIGGER ${table}_${operation.toLowerCase()} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable AI history'); END;`,
      );
}
