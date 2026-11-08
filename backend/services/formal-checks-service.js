import { requireAuthoredWork } from './works/context.js';
import { randomUUID } from 'node:crypto';
import { readNotebook } from '../domain/notebooks.js';
import { runChecks } from '../checks/index.js';
import { createFormalChecksRepository } from '../repositories/formal-checks-repository.js';
function context(workspace, p) {
  return {
    ...requireAuthoredWork(workspace, p),
    repo: createFormalChecksRepository(workspace.connection),
  };
}
export function getFormalChecks(workspace, p) {
  const { item, author, repo } = context(workspace, p);
  return { runs: repo.history(item.id, author.id) };
}
export function runFormalChecks(workspace, p) {
  // До записи проверяем оригинал и его хеш. После записи результаты уже неизменяемы.
  return workspace.transaction(() => {
    const { item, author, repo } = context(workspace, p);
    const notebook = readNotebook(workspace.files.readOriginal(item));
    const results = runChecks(notebook, {
      ...repo.settings(item.assignment_revision_id),
      filename: item.original_name,
    });
    repo.insert({
      id: randomUUID(),
      importId: item.id,
      assignmentRevisionId: item.assignment_revision_id,
      authorEventId: author.id,
      createdAt: new Date().toISOString(),
      results,
    });
    return { runs: repo.history(item.id, author.id) };
  });
}
