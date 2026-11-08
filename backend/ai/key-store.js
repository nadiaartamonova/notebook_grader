import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { UserError } from '../errors.js';
export function createKeyStore(directory, safeStorage) {
  const path = join(directory, 'openai-key.bin');
  function available() {
    if (!safeStorage.isEncryptionAvailable())
      throw new UserError(
        'Шифрование ключа недоступно в этой учётной записи ОС. Ключ не сохранён.',
      );
  }
  function load() {
    available();
    if (!existsSync(path)) throw new UserError('Сначала сохраните ключ OpenAI.');
    try {
      return safeStorage.decryptString(readFileSync(path));
    } catch {
      throw new UserError(
        'Не удалось расшифровать ключ. Сохраните его заново в текущей учётной записи ОС.',
      );
    }
  }
  return {
    load,
    info() {
      if (!existsSync(path)) return { hasKey: false, last4: '' };
      try {
        const key = load();
        return { hasKey: true, last4: key.slice(-4) };
      } catch (error) {
        return { hasKey: true, last4: '', storageError: error.message };
      }
    },
    save(key) {
      available();
      if (typeof key !== 'string' || !/^[\x21-\x7e]{20,512}$/.test(key))
        throw new UserError('Введите ключ API без пробелов (20–512 символов).');
      try {
        writeFileSync(path + '.tmp', safeStorage.encryptString(key), { mode: 0o600 });
        renameSync(path + '.tmp', path);
      } catch {
        throw new UserError('Не удалось сохранить зашифрованный ключ.');
      }
      return this.info();
    },
    remove() {
      try {
        rmSync(path, { force: true });
        rmSync(path + '.tmp', { force: true });
      } catch {
        throw new UserError('Не удалось удалить файл ключа.');
      }
      return { hasKey: false, last4: '' };
    },
  };
}
