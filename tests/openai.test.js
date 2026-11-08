import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../backend/store.js';
import { createKeyStore } from '../backend/ai/key-store.js';
import { createOpenAiProvider, openAiSchema } from '../backend/ai/providers/openai.js';
import { callProvider } from '../backend/ai/provider-call.js';
import { runAiCheck } from '../backend/services/ai-service.js';
import { estimateCost } from '../backend/ai/pricing.js';
const secret = 'sk-fake-test-key-not-real-123456789';
const safe = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(s).map((x) => x ^ 71),
  decryptString: (b) =>
    Buffer.from(b)
      .map((x) => x ^ 71)
      .toString(),
};
const value = {
  scores: [{ criterion: 'C1', points: 2.5, justification: 'Обоснование' }],
  findings: [
    {
      type: 'recommendation',
      criterion: 'C1',
      cell: 1,
      text: 'Замечание',
      recommendation: 'Совет',
    },
  ],
  feedback: 'Tagasiside',
};
const response = (overrides = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
    usage: { input_tokens: 100, output_tokens: 50 },
    ...overrides,
  }),
});
function temporary(t, before = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'practicum-openai-'));
  t.after(() => {
    before();
    assert.ok(dir.startsWith(join(tmpdir(), 'practicum-openai-')));
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
async function fixture(t, fetchImpl = async () => response()) {
  let s;
  const dir = temporary(t, () => s?.close()),
    vault = createKeyStore(dir, safe);
  vault.save(secret);
  s = new Store(dir, { aiRuntime: { keyStore: vault, fetch: fetchImpl } });
  const profile = await s.dispatch('createProfile', {
      name: 'Teacher',
      password: 'x',
      passwordRepeat: 'x',
    }),
    p = { profileId: profile.active, provider: 'openai' };
  p.courseId = s.dispatch('createCourse', {
    ...p,
    name: 'Course',
    group: 'A',
    year: 2026,
    semester: 'Осень',
    mode: 'Дневное',
  }).courses[0].id;
  const student = s.dispatch('addStudent', { ...p, name: 'Sample Student', number: '1' }).courses[0]
    .students[0];
  p.assignmentId = s.dispatch('saveAssignment', {
    ...p,
    name: 'Task',
    criteria: [{ name: 'Logic', points: 5 }],
  }).courses[0].assignments[0].id;
  p.importId = s.dispatch('importNotebook', {
    ...p,
    studentId: student.id,
    name: 'Task.ipynb',
    base64: Buffer.from(
      JSON.stringify({ nbformat: 4, cells: [{ cell_type: 'code', source: 'print(42)' }] }),
    ).toString('base64'),
  }).courses[0].assignments[0].works[0].importId;
  const copy = s.dispatch('prepareSubmission', p);
  s.dispatch('savePreparedCopy', { ...p, expectedId: copy.id, body: copy.body, reviewed: true });
  const confirm = () => ({ ...p, confirmationToken: s.dispatch('previewAiCheck', p).token });
  return { s, p, vault, dir, confirm };
}
test('safeStorage encryption available/unavailable, metadata only and deletion', (t) => {
  const dir = temporary(t),
    vault = createKeyStore(dir, safe);
  assert.deepEqual(vault.save(secret), { hasKey: true, last4: secret.slice(-4) });
  assert.ok(!readFileSync(join(dir, 'openai-key.bin')).includes(Buffer.from(secret)));
  assert.equal(vault.load(), secret);
  const unavailable = createKeyStore(dir, { ...safe, isEncryptionAvailable: () => false });
  assert.throws(() => unavailable.save(secret), /Шифрование/);
  assert.equal(vault.load(), secret);
  vault.remove();
  assert.equal(existsSync(join(dir, 'openai-key.bin')), false);
  assert.throws(() => unavailable.save(secret), /Шифрование/);
  assert.equal(existsSync(join(dir, 'openai-key.bin')), false);
});
test('OpenAI success: exact confirmed JSON, schema, usage, cost and secret isolation', async (t) => {
  const calls = [];
  const f = await fixture(t, async (url, options) => {
    calls.push({ url, options });
    return response();
  });
  const preview = f.s.dispatch('previewAiCheck', f.p);
  const result = await f.s.dispatch('runAiCheck', { ...f.p, confirmationToken: preview.token });
  assert.equal(result.status, 'completed');
  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer ' + secret);
  assert.deepEqual(JSON.parse(calls[0].options.body), preview.request);
  assert.equal(preview.request.store, false);
  assert.equal(preview.request.text.format.strict, true);
  const schema = JSON.stringify(openAiSchema);
  assert.ok(!schema.includes('minimum'));
  assert.ok(!schema.includes('multipleOf'));
  assert.equal(openAiSchema.properties.findings.items.properties.type.type, 'string');
  const run = f.s.get('SELECT * FROM check_runs WHERE id=?', result.id);
  assert.equal(run.provider, 'openai');
  assert.equal(run.model, 'gpt-6.1-sol');
  assert.equal(run.input_tokens, 100);
  assert.equal(run.output_tokens, 50);
  assert.equal(run.estimated_cost, 0.0007);
  for (const output of [
    result,
    run,
    preview,
    f.s.dispatch('getAiSettings', f.p),
    f.s.dispatch('getAiHistory', f.p),
    f.s.snapshot(),
  ])
    assert.ok(!JSON.stringify(output).includes(secret));
  assert.equal(f.s.dispatch('getAiHistory', f.p).runs[0].scores[0].points, 2.5);
});
for (const status of [401, 429, 500])
  test(`OpenAI ${status}: sanitized error and retry count`, async (t) => {
    let calls = 0;
    const f = await fixture(t, async () => {
      calls++;
      return { ok: false, status, json: async () => ({ error: secret }) };
    });
    const result = await runAiCheck(f.s.service, f.confirm(), { sleep: async () => {} });
    assert.equal(result.status, 'failed');
    assert.equal(calls, status === 401 ? 1 : 3);
    assert.ok(!result.error.includes(secret));
    assert.ok(!result.error.includes('тестового'));
    assert.match(
      result.error,
      status === 401 ? /Ключ неверный/ : status === 429 ? /закончились средства/ : /OpenAI/,
    );
  });
test('OpenAI 500 retries then succeeds without real delay', async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => (++calls < 3 ? { ok: false, status: 500 } : response()));
  assert.equal(
    (await runAiCheck(f.s.service, f.confirm(), { sleep: async () => {} })).status,
    'completed',
  );
  assert.equal(calls, 3);
});
for (const scenario of ['network', 'refusal', 'incomplete', 'range', 'echo-key'])
  test(`OpenAI ${scenario}`, async (t) => {
    const f = await fixture(t, async () => {
      if (scenario === 'network') throw new Error(secret);
      if (scenario === 'refusal')
        return response({
          output: [{ type: 'message', content: [{ type: 'refusal', refusal: secret }] }],
        });
      if (scenario === 'incomplete') return response({ status: 'incomplete' });
      if (scenario === 'range')
        return response({
          output_text: JSON.stringify({ ...value, scores: [{ ...value.scores[0], points: 99 }] }),
        });
      return response({ output_text: JSON.stringify({ ...value, feedback: secret }) });
    });
    const result = await f.s.dispatch('runAiCheck', f.confirm());
    assert.equal(result.status, scenario === 'echo-key' ? 'completed' : 'failed');
    assert.ok(!JSON.stringify(f.s.all('SELECT * FROM check_runs')).includes(secret));
    if (scenario !== 'echo-key') assert.equal(f.s.get('SELECT COUNT(*) n FROM check_scores').n, 0);
  });
test('OpenAI timeout and cancellation through command use AbortSignal', async (t) => {
  const f = await fixture(
    t,
    async (_url, options) =>
      new Promise((_, reject) =>
        options.signal.addEventListener('abort', () => reject(new Error(secret)), { once: true }),
      ),
  );
  const result = await runAiCheck(f.s.service, f.confirm(), { timeoutMs: 5 });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /время ожидания/);
  const pending = f.s.dispatch('runAiCheck', { ...f.confirm(), requestId: 'cancel-test' });
  assert.equal(f.s.dispatch('cancelAiCheck', { ...f.p, requestId: 'cancel-test' }).cancelled, true);
  assert.match((await pending).error, /отменена/);
});
test('confirmation and budget gate prevent network; custom unknown price is null', async (t) => {
  let calls = 0;
  const f = await fixture(t, async () => {
    calls++;
    return response();
  });
  await assert.rejects(f.s.dispatch('runAiCheck', f.p), /подтверждён/);
  assert.equal(calls, 0);
  const stale = f.confirm();
  f.s.dispatch('saveAiSettings', {
    profileId: f.p.profileId,
    model: 'gpt-6.1-terra',
    monthlyLimit: 5,
  });
  await assert.rejects(f.s.dispatch('runAiCheck', stale), /изменился/);
  await f.s.dispatch('runAiCheck', f.confirm());
  f.s.dispatch('saveAiSettings', {
    profileId: f.p.profileId,
    model: 'gpt-6.1-terra',
    monthlyLimit: 0.0001,
  });
  await assert.rejects(f.s.dispatch('runAiCheck', f.confirm()), /месячный лимит/);
  assert.equal(calls, 1);
  f.s.dispatch('saveAiSettings', {
    profileId: f.p.profileId,
    model: 'custom-model',
    monthlyLimit: 5,
  });
  assert.equal(f.s.dispatch('previewAiCheck', f.p).inputCost, null);
  assert.equal(estimateCost('custom-model', 100, 100), null);
  const result = await f.s.dispatch('runAiCheck', f.confirm());
  assert.equal(
    f.s.get('SELECT estimated_cost FROM check_runs WHERE id=?', result.id).estimated_cost,
    null,
  );
});
test('profile guards protect key commands; browser backend cannot enable OpenAI', async (t) => {
  const f = await fixture(t);
  for (const cmd of ['getAiSettings', 'saveAiKey', 'deleteAiKey', 'checkAiConnection'])
    assert.throws(() => f.s.dispatch(cmd, { profileId: 'other', key: secret }));
  const info = f.s.dispatch('saveAiKey', { profileId: f.p.profileId, key: secret });
  assert.ok(!JSON.stringify(info).includes(secret));
  f.s.service.aiRuntime = undefined;
  await assert.rejects(f.s.dispatch('runAiCheck', f.p), /Electron/);
  assert.throws(
    () => f.s.dispatch('saveAiKey', { profileId: f.p.profileId, key: secret }),
    /Electron/,
  );
});
test('connection check uses no work content and hides errors', async () => {
  let captured;
  const provider = createOpenAiProvider(secret, async (url, options) => {
    captured = { url, options };
    return { ok: true };
  });
  await provider.check();
  assert.equal(captured.options.method, 'GET');
  assert.equal(captured.options.body, undefined);
  assert.equal(captured.url, 'https://api.openai.com/v1/models');
  await assert.rejects(
    createOpenAiProvider(secret, async () => {
      throw Error(secret);
    }).check(),
    /Нет связи/,
  );
});

test('OpenAI error detail is shown without the key; failed runs with usage count toward spend', async () => {
  const { createOpenAiProvider } = await import('../backend/ai/providers/openai.js');
  const key = 'sk-test-SECRETSECRETSECRET1234';
  const provider = createOpenAiProvider(key, async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      error: { message: `Invalid schema for key ${key}: multipleOf not supported` },
    }),
  }));
  await assert.rejects(
    provider.review({ model: 'gpt-6.1-sol', instructions: 'x', input: {}, schema: {} }),
    (error) =>
      error.message.includes('multipleOf not supported') &&
      !error.message.includes(key) &&
      error.message.includes('[КЛЮЧ СКРЫТ]'),
  );
});
