import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { UserError } from '../errors.js';
export class FileRepository {
  constructor(directory) {
    this.directory = directory;
    for (const part of ['files', 'staging']) mkdirSync(join(directory, part), { recursive: true });
  }
  hash(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
  }
  saveOriginal(key, bytes) {
    writeFileSync(join(this.directory, 'staging', key), bytes, { flag: 'wx', flush: true });
    renameSync(join(this.directory, 'staging', key), join(this.directory, 'files', key));
  }
  readOriginal(item) {
    if (item.status !== 'ready') throw new UserError('Импорт не завершён: оригинал недоступен.');
    let bytes;
    try {
      bytes = readFileSync(join(this.directory, 'files', item.storage_key));
    } catch {
      throw new UserError('Оригинал не найден на диске. Загрузите исходный файл заново.');
    }
    if (this.hash(bytes) !== item.sha256)
      throw new UserError('Оригинал изменился на диске. Подготовка копии остановлена.');
    return bytes;
  }
  recover(item) {
    const temporary = join(this.directory, 'staging', item.storage_key),
      target = join(this.directory, 'files', item.storage_key);
    if (!existsSync(target) && existsSync(temporary)) renameSync(temporary, target);
    if (!existsSync(target) || this.hash(readFileSync(target)) !== item.sha256)
      throw new Error('Incomplete import');
  }
}
