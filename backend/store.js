import { createAiRepository } from './repositories/ai-repository.js';
import { AuthService, authCommands } from './services/auth-service.js';
import { Connection } from './database/connection.js';
import { createRepositories } from './repositories/index.js';
import { FileRepository } from './repositories/file-repository.js';
import { WorkspaceService } from './services/workspace-service.js';
import { recoverImports } from './services/submission-service.js';
export { UserError } from './errors.js';

// Composition root shared by Electron and the local development server.
export class Store {
  constructor(directory, options = {}) {
    this.connection = new Connection(directory);
    try {
      this.repositories = createRepositories(this.connection);
      this.files = new FileRepository(directory);
      this.auth = new AuthService(this.connection, this.repositories.profiles, options);
      this.service = new WorkspaceService(
        this.connection,
        this.repositories,
        this.files,
        this.auth,
      );
      this.service.aiDevelopment = options.aiDevelopment === true;
      this.service.aiRuntime = options.aiRuntime;
      this.service.aiPreviews = new Map();
      this.service.aiPending = new Map();
      this.connection.transaction(() => {
        recoverImports(this.service);
        createAiRepository(this.connection).recover();
      });
    } catch (error) {
      this.connection.close();
      throw error;
    }
  }
  dispatch(command, payload) {
    if (authCommands.has(command))
      return this.auth
        .execute(command, payload)
        .then((result) => ({ ...this.snapshot(), ...result }));
    return this.service.dispatch(command, payload);
  }
  snapshot() {
    return this.service.snapshot();
  }
  active() {
    return this.service.active();
  }
  close() {
    this.connection.close();
  }
  // Diagnostic access used by persistence and migration tests, never exposed over IPC.
  get db() {
    return this.connection.db;
  }
  get(sql, ...args) {
    return this.connection.get(sql, ...args);
  }
  all(sql, ...args) {
    return this.connection.all(sql, ...args);
  }
  run(sql, ...args) {
    return this.connection.run(sql, ...args);
  }
}
