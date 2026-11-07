import { randomUUID } from 'node:crypto';
import { UserError } from '../errors.js';
import { text } from '../dto/validation.js';
import { passwordPolicy, validateNewPassword } from '../auth/password-policy.js';
import { hashSecret, verifySecret, parameters, recoveryCode } from '../auth/password-hash.js';
import { createAuthRepository } from '../repositories/auth-repository.js';
export const authCommands = new Set([
  'createProfile',
  'selectProfile',
  'leaveProfile',
  'setupPassword',
  'changePassword',
  'recoverProfile',
]);

// Сессия и счётчики попыток живут только в памяти. Очередь не даёт параллельным попыткам обойти паузу.
export class AuthService {
  constructor(connection, profiles, { passwordMode = 'test', clock = Date.now } = {}) {
    this.connection = connection;
    this.profiles = profiles;
    this.repo = createAuthRepository(connection);
    this.policy = passwordPolicy(passwordMode);
    this.clock = clock;
    this.active = null;
    this.attempts = new Map();
    this.queue = Promise.resolve();
  }
  execute(command, p = {}) {
    const run = this.queue.then(() => this.perform(command, p));
    this.queue = run.catch(() => {});
    return run;
  }
  pause(profileId) {
    const until = this.attempts.get(profileId)?.until || 0;
    if (until > this.clock())
      throw new UserError(
        `Слишком много неверных попыток. Повторите через ${Math.ceil((until - this.clock()) / 1000)} секунд.`,
      );
    if (until) this.attempts.delete(profileId);
  }
  async check(profileId, secret, record, recovery = false) {
    this.pause(profileId);
    const valid = await verifySecret(
      secret,
      recovery ? record.recovery_hash : record.password_hash,
      recovery ? record.recovery_salt : record.password_salt,
      JSON.parse(record.parameters),
    );
    if (!valid) {
      const count = (this.attempts.get(profileId)?.count || 0) + 1;
      this.attempts.set(profileId, { count, until: count >= 5 ? this.clock() + 30000 : 0 });
      this.pause(profileId);
      throw new UserError(recovery ? 'Неверный код восстановления.' : 'Неверный пароль.');
    }
    this.attempts.delete(profileId);
  }
  async perform(command, p) {
    if (!p || typeof p !== 'object' || Array.isArray(p))
      throw new UserError('Неверный формат команды.');
    if (command === 'leaveProfile') {
      this.active = null;
      return {};
    }
    const creating = command === 'createProfile';
    const profileId = creating ? randomUUID() : command === 'changePassword' ? p.profileId : p.id;
    if (!creating && (typeof profileId !== 'string' || !this.profiles.find(profileId)))
      throw new UserError('Профиль не найден.');
    if (command === 'changePassword' && profileId !== this.active)
      throw new UserError('Войдите в профиль заново.');
    const record = creating ? null : this.repo.find(profileId);
    if (command === 'selectProfile') {
      this.active = null;
      if (!record) throw new UserError('Сначала задайте пароль для этого профиля.');
      await this.check(profileId, p.password, record);
      this.active = profileId;
      return {};
    }
    if (command === 'setupPassword' && record)
      throw new UserError('Пароль уже установлен. Выполните вход.');
    if (command === 'changePassword' || command === 'recoverProfile') {
      if (!record) throw new UserError('Сначала задайте пароль для этого профиля.');
      await this.check(
        profileId,
        command === 'changePassword' ? p.currentPassword : p.recoveryCode,
        record,
        command === 'recoverProfile',
      );
    }
    validateNewPassword(p, this.policy.mode);
    const name = creating ? text(p.name, 'Имя преподавателя', 100) : null;
    const code = recoveryCode();
    const [password, recovery] = await Promise.all([hashSecret(p.password), hashSecret(code)]);
    // Асинхронный scrypt завершается до BEGIN: в транзакции остаются только короткие записи SQLite.
    this.connection.transaction(() => {
      if (creating) this.profiles.insert(profileId, name, new Date().toISOString());
      if (command === 'setupPassword' && this.repo.find(profileId))
        throw new UserError('Пароль уже установлен.');
      if (command === 'changePassword' || command === 'recoverProfile') {
        const current = this.repo.find(profileId);
        if (
          current.password_hash !== record.password_hash ||
          current.recovery_hash !== record.recovery_hash
        )
          throw new UserError('Данные входа уже изменились. Повторите действие.');
      }
      this.repo.save(profileId, password, recovery, parameters, new Date().toISOString());
    });
    this.active = profileId;
    this.attempts.delete(profileId);
    return { recoveryCode: code }; // Показывается один раз; состояние и последующие ответы кода не содержат.
  }
}
