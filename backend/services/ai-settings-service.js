import { UserError } from '../errors.js';
import { createAiRepository } from '../repositories/ai-repository.js';
import { createOpenAiProvider } from '../ai/providers/openai.js';
import { prices, priceDate } from '../ai/pricing.js';
export function monthStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}
export function getAiSettings(w, p) {
  w.requireProfile(p.profileId);
  const prefs = createAiRepository(w.connection).preferences();
  return {
    ...prefs,
    ...(w.aiRuntime?.keyStore?.info() ?? { hasKey: false, last4: '' }),
    available: Boolean(w.aiRuntime?.keyStore),
    mockAvailable: w.aiDevelopment,
    models: Object.keys(prices),
    priceDate,
    spent: createAiRepository(w.connection).spent(monthStart()),
  };
}
export function aiSettingsCommand(w, command, p) {
  w.requireProfile(p.profileId);
  if (command === 'getAiSettings') return getAiSettings(w, p);
  if (command === 'saveAiSettings') {
    if (
      typeof p.model !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(p.model) ||
      typeof p.monthlyLimit !== 'number' ||
      !Number.isFinite(p.monthlyLimit) ||
      p.monthlyLimit < 0 ||
      p.monthlyLimit > 100000
    )
      throw new UserError('Укажите модель и месячный лимит от 0 до 100000 USD.');
    w.transaction(() => createAiRepository(w.connection).savePreferences(p.model, p.monthlyLimit));
    return getAiSettings(w, p);
  }
  const vault = w.aiRuntime?.keyStore;
  if (!vault) throw new UserError('Настоящий ИИ и хранение ключа доступны только в Electron.');
  if (command === 'saveAiKey') {
    vault.save(p.key);
    return getAiSettings(w, p);
  }
  if (command === 'deleteAiKey') {
    vault.remove();
    return getAiSettings(w, p);
  }
  if (command === 'checkAiConnection')
    return createOpenAiProvider(vault.load(), w.aiRuntime.fetch)
      .check(AbortSignal.timeout(12000))
      .then((result) => {
        w.requireProfile(p.profileId);
        return result;
      })
      .catch((error) => {
        if (error instanceof UserError) throw error;
        throw new UserError('Не удалось проверить подключение к OpenAI за 12 секунд.');
      });
  throw new UserError('Неизвестная команда подключения ИИ.');
}
export const aiSettingsCommands = new Set([
  'getAiSettings',
  'saveAiSettings',
  'saveAiKey',
  'deleteAiKey',
  'checkAiConnection',
]);
