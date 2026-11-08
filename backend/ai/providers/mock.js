export const scenarios = [
  'valid',
  'invalid-json',
  'extra-criterion',
  'missing-criterion',
  'out-of-range',
  'missing-cell',
  'timeout',
  '429',
  '500',
  'retry-success',
];
export function createMockProvider(scenario = 'valid') {
  let attempts = 0;
  return {
    async review({ input, signal }) {
      attempts++;
      signal.throwIfAborted();
      if (scenario === 'timeout')
        return new Promise((resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
        );
      if (['429', '500'].includes(scenario) || (scenario === 'retry-success' && attempts < 3)) {
        const e = new Error('Mock provider error');
        e.status = scenario === '500' ? 500 : 429;
        throw e;
      }
      const criteria = input.assignment.criteria;
      const value = {
        scores: criteria.map((c) => ({
          criterion: c.key,
          points: c.points,
          justification: 'Тестовый ответ, не оценка качества кода.',
        })),
        findings: input.cells.length
          ? [
              {
                type: 'assumption',
                criterion: criteria[0].key,
                cell: input.cells[0].number,
                text: 'Тестовое замечание; код не проверялся.',
                recommendation: 'Проверьте работу самостоятельно.',
              },
            ]
          : [],
        feedback: 'See on testvastus, mitte töö tegelik hinnang.',
      };
      if (scenario === 'extra-criterion')
        value.scores.push({ criterion: 'C9999', points: 0, justification: '' });
      if (scenario === 'missing-criterion') value.scores.pop();
      if (scenario === 'out-of-range') value.scores[0].points += 1;
      if (scenario === 'missing-cell')
        value.findings.push({
          type: 'assumption',
          criterion: null,
          cell: 1000001,
          text: 'Тест',
          recommendation: '',
        });
      return {
        text: scenario === 'invalid-json' ? '{' : JSON.stringify(value),
        usage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
      };
    },
    get attempts() {
      return attempts;
    },
  };
}
