import { UserError } from '../errors.js';
const object = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const string = { type: 'string' };
export const responseSchema = object({
  scores: {
    type: 'array',
    items: object({
      criterion: string,
      points: { type: 'number', minimum: 0, multipleOf: 0.5 },
      justification: string,
    }),
  },
  findings: {
    type: 'array',
    items: object({
      type: { enum: ['violation', 'recommendation', 'assumption'] },
      criterion: { type: ['string', 'null'] },
      cell: { type: ['integer', 'null'], minimum: 1 },
      text: string,
      recommendation: string,
    }),
  },
  feedback: string,
});
function shape(value, schema) {
  if (schema.enum && !schema.enum.includes(value))
    throw new UserError('Недопустимый тип замечания.');
  if (!schema.type) return;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (value === null && types.includes('null')) return;
  const type = types[0];
  if (type === 'object') {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== schema.required.length ||
      schema.required.some((k) => !Object.hasOwn(value, k))
    )
      throw new UserError('Неверные или лишние поля ответа ИИ.');
    for (const [key, child] of Object.entries(schema.properties)) shape(value[key], child);
  } else if (type === 'array') {
    if (!Array.isArray(value) || value.length > 10000)
      throw new UserError('Неверный список в ответе ИИ.');
    value.forEach((v) => shape(v, schema.items));
  } else if (type === 'string') {
    if (typeof value !== 'string' || value.length > 100000)
      throw new UserError('Неверный текст в ответе ИИ.');
  } else if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (type === 'integer' && !Number.isInteger(value)) ||
    value < schema.minimum ||
    (schema.multipleOf && !Number.isInteger(value / schema.multipleOf))
  )
    throw new UserError('Неверное числовое значение в ответе ИИ.');
}
export function validateResponse(text, criteria, cells) {
  let value;
  try {
    if (typeof text !== 'string' || text.length > 2000000) throw Error();
    value = JSON.parse(text);
  } catch {
    throw new UserError('Ответ ИИ не является допустимым JSON.');
  }
  shape(value, responseSchema);
  const keys = new Map(criteria.map((c) => [c.key, c])),
    seen = new Set(),
    numbers = new Set(cells.map((c) => c.number));
  for (const score of value.scores) {
    const criterion = keys.get(score.criterion);
    if (!criterion || seen.has(score.criterion))
      throw new UserError('Лишний или повторный критерий в ответе ИИ.');
    if (score.points > criterion.points)
      throw new UserError('Балл ИИ превышает максимум критерия.');
    seen.add(score.criterion);
  }
  if (seen.size !== keys.size) throw new UserError('В ответе ИИ пропущен критерий.');
  for (const finding of value.findings) {
    if (finding.criterion !== null && !keys.has(finding.criterion))
      throw new UserError('Неизвестный критерий замечания.');
    if (finding.cell !== null && !numbers.has(finding.cell))
      throw new UserError('Ячейка замечания отсутствует в копии.');
  }
  return value;
}
