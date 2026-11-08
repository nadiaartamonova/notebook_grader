import { setTimeout as delay } from 'node:timers/promises';
import { UserError } from '../errors.js';
export async function callProvider(
  provider,
  request,
  { timeoutMs = 1000, signal, sleep = (ms, signal) => delay(ms, undefined, { signal }) } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort(new UserError('Проверка отменена.'));
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new UserError('Истекло время ожидания ответа ИИ.')),
    timeoutMs,
  );
  let rejectAbort;
  const aborted = new Promise((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });
  try {
    controller.signal.throwIfAborted();
    return await Promise.race([
      aborted,
      (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          controller.signal.throwIfAborted();
          try {
            return await provider.review({ ...request, signal: controller.signal });
          } catch (error) {
            controller.signal.throwIfAborted();
            if (
              attempt === 2 ||
              !(error.status === 429 || (error.status >= 500 && error.status <= 599))
            )
              throw new UserError(
                error.status === 429
                  ? 'Поставщик ограничил частоту запросов (429).'
                  : 'Ошибка тестового поставщика.',
              );
            await sleep(100 * (attempt + 1), controller.signal);
          }
        }
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', rejectAbort);
  }
}
