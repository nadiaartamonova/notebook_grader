// Команды работ студентов. Сама логика — в services/works/*; здесь только список команд
// и признак, нужна ли транзакция (изменяющие команды выполняются целиком или не выполняются).
import { importNotebook, recoverImports } from './works/import-service.js';
import { assignAuthor, changeAuthor, deleteWork } from './works/author-service.js';
import { readOriginal, workHistory } from './works/view-service.js';
import { getPreparedCopy, prepareCopy, saveCopy } from './works/copy-service.js';

export { recoverImports };

const commands = {
  importNotebook: { run: importNotebook, transaction: true },
  assignSubmission: { run: (store, p) => assignAuthor(store, p), transaction: true },
  changeSubmissionAuthor: { run: changeAuthor, transaction: true },
  deleteSubmission: { run: deleteWork, transaction: true },
  getSubmissionHistory: { run: workHistory, transaction: false },
  readSubmission: { run: readOriginal, transaction: false },
  getPreparedCopy: { run: getPreparedCopy, transaction: false },
  prepareSubmission: { run: prepareCopy, transaction: true },
  savePreparedCopy: { run: saveCopy, transaction: true },
};

export const submissionCommands = new Set(Object.keys(commands));

export function submissionCommand(store, command, p) {
  const { run, transaction } = commands[command];
  return transaction ? store.transaction(() => run(store, p)) : run(store, p);
}
