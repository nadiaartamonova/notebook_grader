// Расчётная таблица из задания; доступность модели определяется аккаунтом OpenAI.
export const priceDate = '08.11.2026';
export const prices = {
  'gpt-6.1-sol': [2, 10],
  'gpt-6.1-terra': [1, 5],
  'gpt-6-astra': [10, 50],
  'gpt-5.4-mini': [0.75, 4.5],
};
export function estimateCost(model, inputTokens, outputTokens = 0) {
  const rate = prices[model];
  return rate ? (inputTokens * rate[0] + outputTokens * rate[1]) / 1e6 : null;
}
