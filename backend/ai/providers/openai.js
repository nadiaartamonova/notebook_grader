import { UserError } from '../../errors.js';
import { responseSchema } from '../response.js';
import { estimateCost } from '../pricing.js';
function simplify(schema) {
  const result = {};
  for (const key of ['type', 'properties', 'required', 'additionalProperties', 'enum', 'items'])
    if (schema[key] !== undefined)
      result[key] =
        key === 'properties'
          ? Object.fromEntries(Object.entries(schema[key]).map(([k, v]) => [k, simplify(v)]))
          : key === 'items'
            ? simplify(schema[key])
            : schema[key];
  if (result.enum && !result.type) result.type = 'string';
  return result;
}
export const openAiSchema = simplify(responseSchema);
export function openAiBody({ model, instructions, input }) {
  return {
    model,
    instructions,
    input: JSON.stringify(input),
    text: {
      format: { type: 'json_schema', name: 'teacher_review', schema: openAiSchema, strict: true },
    },
    store: false,
  };
}
function httpError(status, detail = '') {
  const error = new UserError(
    (status === 401
      ? 'Ключ неверный или отозван'
      : status === 429
        ? 'Превышен лимит запросов или закончились средства на счёте OpenAI'
        : status >= 500
          ? 'Сервис OpenAI временно недоступен'
          : status === 404
            ? 'Модель недоступна. Проверьте название и доступ в аккаунте OpenAI.'
            : 'OpenAI отклонил запрос. Проверьте модель и её поддержку структурированного ответа.') +
      (detail ? ` Ответ OpenAI: ${detail}` : ''),
  );
  error.status = status;
  return error;
}
export function createOpenAiProvider(key, fetchImpl = globalThis.fetch) {
  async function request(url, options) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      });
    } catch {
      if (options.signal?.aborted) throw options.signal.reason;
      throw new UserError('Нет связи с OpenAI');
    }
    if (!response.ok) {
      // Пояснение OpenAI (например, о неподдерживаемой схеме) помогает понять причину отказа.
      // Ключ из текста вырезается, длина ограничена.
      let detail = '';
      try {
        const body = await response.json();
        if (typeof body?.error?.message === 'string')
          detail = body.error.message.split(key).join('[КЛЮЧ СКРЫТ]').slice(0, 300);
      } catch {
        // Тело без JSON — оставляем общее сообщение.
      }
      throw httpError(response.status, detail);
    }
    return response;
  }
  return {
    async check(signal) {
      await request('https://api.openai.com/v1/models', { method: 'GET', signal });
      return {
        message:
          'Подключение к OpenAI проверено. Доступность выбранной модели проверяется при запуске.',
      };
    },
    async review({ signal, ...params }) {
      const response = await request('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal,
        body: JSON.stringify(openAiBody(params)),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        if (signal?.aborted) throw signal.reason;
        throw new UserError('OpenAI вернул нечитаемый ответ.');
      }
      if (data.status === 'incomplete')
        throw new UserError('OpenAI не завершил ответ (incomplete).');
      const content = (data.output ?? [])
        .filter((o) => o.type === 'message')
        .flatMap((o) => o.content ?? []);
      if (content.some((c) => c.type === 'refusal') || data.refusal)
        throw new UserError('Модель OpenAI отказалась выполнить проверку.');
      if (data.status && data.status !== 'completed')
        throw new UserError('OpenAI не завершил проверку.');
      let text =
        data.output_text ??
        content
          .filter((c) => c.type === 'output_text')
          .map((c) => c.text)
          .join('');
      if (typeof text !== 'string' || !text) throw new UserError('OpenAI не вернул текст ответа.');
      // Защита от случайного отражения секрета тестовым или ошибочным ответом.
      text = text.split(key).join('[КЛЮЧ СКРЫТ]');
      const inputTokens = data.usage?.input_tokens,
        outputTokens = data.usage?.output_tokens;
      if (
        !Number.isInteger(inputTokens) ||
        inputTokens < 0 ||
        !Number.isInteger(outputTokens) ||
        outputTokens < 0
      )
        throw new UserError('OpenAI не вернул корректный расход токенов.');
      return {
        text,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCost: estimateCost(params.model, inputTokens, outputTokens),
        },
      };
    },
  };
}
