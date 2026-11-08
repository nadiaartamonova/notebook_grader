import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../backend/store.js';
import { runAiCheck } from '../backend/services/ai-service.js';
import { createAiRepository } from '../backend/repositories/ai-repository.js';
import { createMockProvider } from '../backend/ai/providers/mock.js';
import { callProvider } from '../backend/ai/provider-call.js';
import { validateResponse } from '../backend/ai/response.js';
import { instructions } from '../backend/ai/prompts/review-v1.js';
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'practicum-ai-'));
  let s = new Store(dir, { aiDevelopment: true });
  t.after(() => {
    s.close();
    assert.ok(dir.startsWith(join(tmpdir(), 'practicum-ai-')));
    rmSync(dir, { recursive: true, force: true });
  });
  const state = await s.dispatch('createProfile', {
      name: 'Teacher',
      password: 'x',
      passwordRepeat: 'x',
    }),
    p = { profileId: state.active };
  const values = { name: 'Course', group: 'A', year: 2026, semester: 'Осень', mode: 'Дневное' };
  p.courseId = s.dispatch('createCourse', { ...p, ...values }).courses[0].id;
  const student = s.dispatch('addStudent', { ...p, name: 'Sample Student', number: '100' })
    .courses[0].students[0];
  const assignment = s.dispatch('saveAssignment', {
    ...p,
    name: 'Task',
    criteria: [
      { name: 'Logic', points: 5 },
      { name: 'Style', points: 2 },
    ],
    feedbackLanguage: 'эстонский',
  }).courses[0].assignments[0];
  p.assignmentId = assignment.id;
  p.importId = s.dispatch('importNotebook', {
    ...p,
    studentId: student.id,
    name: 'Task_SampleStudent.ipynb',
    base64: Buffer.from(
      JSON.stringify({
        nbformat: 4,
        cells: [
          { cell_type: 'markdown', source: '# Sample Student\n01.01.2026' },
          { cell_type: 'raw', source: 'private' },
          { cell_type: 'code', source: 'print(42)', outputs: [{ text: 'secret output' }] },
        ],
      }),
    ).toString('base64'),
  }).courses[0].assignments[0].works[0].importId;
  const copy = s.dispatch('prepareSubmission', p);
  const review = () =>
    s.dispatch('savePreparedCopy', {
      ...p,
      expectedId: s.dispatch('getPreparedCopy', p).id,
      body: s.dispatch('getPreparedCopy', p).body,
      reviewed: true,
    });
  return {
    get s() {
      return s;
    },
    p,
    copy,
    review,
    assignment,
    values,
    async reopen() {
      s.close();
      s = new Store(dir, { aiDevelopment: true });
      await s.dispatch('selectProfile', { id: p.profileId, password: 'x' });
    },
  };
}
test('keyed reviewed copy builds a private snapshot, pins criteria and persists immutable results', async (t) => {
  const { s, p, copy, review } = await fixture(t);
  assert.deepEqual(
    JSON.parse(copy.body).assignment.criteria.map((c) => c.key),
    ['C1', 'C2'],
  );
  await assert.rejects(s.dispatch('runAiCheck', p), /просмотрено/);
  const reviewed = review();
  s.dispatch('runFormalChecks', p);
  // Более поздняя непросмотренная редакция не подменяет просмотренную.
  s.dispatch('savePreparedCopy', {
    ...p,
    expectedId: reviewed.id,
    body: reviewed.body.replace('print(42)', 'unreviewed'),
    reviewed: false,
  });
  const result = await s.dispatch('runAiCheck', p);
  assert.equal(result.status, 'completed');
  const run = s.get('SELECT * FROM check_runs WHERE id=?', result.id),
    request = JSON.parse(run.request_json);
  assert.equal(run.copy_id, reviewed.id);
  assert.ok(request.input.formalChecks.length);
  assert.ok(!run.request_json.includes('Sample'));
  assert.ok(!run.request_json.includes('secret output'));
  assert.ok(!run.request_json.includes('unreviewed'));
  assert.equal(request.input.assignment.feedbackLanguage, 'эстонский');
  assert.ok(instructions.includes('Не упоминай имена людей'));
  assert.equal(s.get('SELECT COUNT(*) n FROM check_scores').n, 2);
  assert.equal(run.estimated_cost, 0);
  for (const sql of [
    "UPDATE check_runs SET feedback='changed'",
    'DELETE FROM check_runs',
    'DELETE FROM check_scores',
    'DELETE FROM check_findings',
    "UPDATE check_findings SET text='changed'",
    'UPDATE check_scores SET half_points=0',
  ])
    assert.throws(() => s.run(sql), /Immutable/);
  assert.throws(
    () =>
      s.run(
        'INSERT INTO check_findings(run_id,type,text,recommendation) VALUES (?,?,?,?)',
        result.id,
        'assumption',
        'x',
        '',
      ),
    /Invalid/,
  );
  assert.equal(s.get('SELECT COUNT(*) n FROM check_findings').n, 1);
});
for (const scenario of [
  'invalid-json',
  'extra-criterion',
  'missing-criterion',
  'out-of-range',
  'missing-cell',
  'timeout',
  '429',
  '500',
])
  test(`mock ${scenario}: failed without partial grades`, async (t) => {
    const { s, p, review } = await fixture(t);
    review();
    const result = await runAiCheck(
      s.service,
      { ...p, scenario },
      { timeoutMs: scenario === 'timeout' ? 5 : 1000, sleep: async () => {} },
    );
    assert.equal(result.status, 'failed');
    assert.ok(result.error);
    assert.equal(s.get('SELECT COUNT(*) n FROM check_scores').n, 0);
    assert.equal(s.get('SELECT COUNT(*) n FROM check_findings').n, 0);
    if (!['timeout', '429', '500'].includes(scenario))
      assert.ok(s.get('SELECT response_text FROM check_runs').response_text);
  });
test('retry limit, transient success, timeout and AbortSignal', async () => {
  const request = { input: { assignment: { criteria: [{ key: 'C1', points: 2 }] }, cells: [] } };
  for (const scenario of ['429', '500']) {
    const provider = createMockProvider(scenario);
    await assert.rejects(callProvider(provider, request, { sleep: async () => {} }));
    assert.equal(provider.attempts, 3);
  }
  const provider = createMockProvider('retry-success');
  await callProvider(provider, request, { sleep: async () => {} });
  assert.equal(provider.attempts, 3);
  const c = new AbortController(),
    pending = callProvider(createMockProvider('timeout'), request, { signal: c.signal });
  c.abort();
  await assert.rejects(pending, /отменена/);
  const already = new AbortController();
  already.abort();
  await assert.rejects(callProvider(provider, request, { signal: already.signal }), /отменена/);
});
test('strict response rejects wrong types, extra fields, duplicates and unknown references', () => {
  const criteria = [{ key: 'C1', points: 2 }],
    cells = [{ number: 3 }];
  const valid = {
    scores: [{ criterion: 'C1', points: 0.5, justification: '' }],
    findings: [{ type: 'assumption', criterion: null, cell: 3, text: '', recommendation: '' }],
    feedback: '',
  };
  assert.deepEqual(validateResponse(JSON.stringify(valid), criteria, cells), valid);
  const mutations = [
    (v) => (v.extra = 1),
    (v) => (v.scores[0].points = 0.2),
    (v) => (v.scores[0].points = '1'),
    (v) => v.scores.push(v.scores[0]),
    (v) => (v.findings[0].cell = 1),
    (v) => (v.findings[0].criterion = 'C2'),
    (v) => (v.findings[0].type = 'other'),
    (v) => (v.findings[0].extra = 1),
    (v) => delete v.feedback,
  ];
  for (const mutate of mutations) {
    const value = structuredClone(valid);
    mutate(value);
    assert.throws(() => validateResponse(JSON.stringify(value), criteria, cells));
  }
});
test('legacy copy stays unchanged, regeneration creates keys; edited keys are rejected', async (t) => {
  const { s, p, copy } = await fixture(t),
    repo = createAiRepository(s.connection),
    version = s.repositories.submissions.findAuthorVersion(p.importId);
  const body = JSON.parse(copy.body);
  body.assignment.criteria.forEach((c) => delete c.key);
  s.connection.transaction(() => {
    s.repositories.submissions.insertCopy(
      'legacy',
      version.id,
      2,
      copy.request_id,
      JSON.stringify(body),
      '{}',
      1,
      new Date().toISOString(),
    );
    s.repositories.submissions.linkCopy('legacy', version.authorEventId);
  });
  await assert.rejects(s.dispatch('runAiCheck', p), /ключей/);
  const fresh = s.dispatch('prepareSubmission', p);
  assert.notEqual(fresh.id, 'legacy');
  assert.equal(repo.keys(fresh.id).length, 2);
  assert.equal(
    s.get("SELECT body FROM prepared_copies WHERE id='legacy'").body,
    JSON.stringify(body),
  );
  const modified = JSON.parse(fresh.body);
  modified.assignment.criteria[0].key = 'C99';
  s.dispatch('savePreparedCopy', {
    ...p,
    expectedId: fresh.id,
    body: JSON.stringify(modified),
    reviewed: true,
  });
  await assert.rejects(s.dispatch('runAiCheck', p), /Ключи/);
});
test('restart interrupts queued and running records and keeps completed results', async (t) => {
  const f = await fixture(t);
  f.review();
  const result = await f.s.dispatch('runAiCheck', f.p),
    row = f.s.get('SELECT * FROM check_runs WHERE id=?', result.id),
    repo = createAiRepository(f.s.connection);
  f.s.connection.transaction(() => {
    for (const id of ['queued', 'running'])
      repo.insert({
        id,
        importId: row.import_id,
        authorId: row.author_event_id,
        revisionId: row.assignment_revision_id,
        copyId: row.copy_id,
        model: row.model,
        promptVersion: row.prompt_version,
        request: JSON.parse(row.request_json),
      });
    repo.start('running');
  });
  await f.reopen();
  assert.equal(f.s.get("SELECT status FROM check_runs WHERE id='queued'").status, 'interrupted');
  assert.equal(f.s.get("SELECT status FROM check_runs WHERE id='running'").status, 'interrupted');
  assert.equal(f.s.get('SELECT status FROM check_runs WHERE id=?', result.id).status, 'completed');
});
test('access boundaries, development gate and atomic persistence failure', async (t) => {
  const { s, p, review } = await fixture(t);
  review();
  for (const override of [
    { profileId: 'other' },
    { courseId: 'other' },
    { assignmentId: 'other' },
    { importId: 'other' },
    { provider: 'openai' },
  ])
    await assert.rejects(s.dispatch('runAiCheck', { ...p, ...override }));
  s.service.aiDevelopment = false;
  await assert.rejects(s.dispatch('runAiCheck', p), /разработке/);
  s.service.aiDevelopment = true;
  s.db.exec(
    "CREATE TRIGGER fail_ai_score BEFORE INSERT ON check_scores WHEN NEW.half_points=4 BEGIN SELECT RAISE(ABORT,'test failure'); END;",
  );
  assert.equal((await s.dispatch('runAiCheck', p)).status, 'failed');
  assert.equal(s.get('SELECT COUNT(*) n FROM check_scores').n, 0);
  s.dispatch('deleteSubmission', { ...p, confirmDelete: true });
  await assert.rejects(s.dispatch('runAiCheck', p), /недоступна/);
});
test('cancelled running check fails and changed author cannot receive old scores', async (t) => {
  const { s, p, review } = await fixture(t);
  review();
  const controller = new AbortController();
  const pending = runAiCheck(
    s.service,
    { ...p, scenario: 'timeout' },
    { signal: controller.signal },
  );
  assert.equal(s.get('SELECT status FROM check_runs').status, 'running');
  controller.abort();
  assert.equal((await pending).status, 'failed');
  const old = s.repositories.submissions.currentAuthor(p.importId),
    student = s
      .dispatch('addStudent', { ...p, name: 'Other Student', number: '101' })
      .courses[0].students.find((x) => x.number === '101');
  const check = s.dispatch('runAiCheck', p);
  s.dispatch('changeSubmissionAuthor', {
    ...p,
    studentId: student.id,
    expectedAuthorEventId: old.id,
  });
  assert.equal((await check).status, 'failed');
  assert.equal(s.get('SELECT COUNT(*) n FROM check_scores').n, 0);
  await assert.rejects(s.dispatch('runAiCheck', p), /просмотрено/);
});
test('feedback language survives assignment edits and course copy', async (t) => {
  const { s, p, assignment, values } = await fixture(t);
  let edited = s.dispatch('saveAssignment', {
    ...p,
    id: assignment.id,
    expectedRevision: assignment.revision_id,
    name: 'Task',
    criteria: [{ name: 'Logic', points: 1 }],
    feedbackLanguage: 'русский',
  }).courses[0].assignments[0];
  edited = s.dispatch('saveAssignment', {
    ...p,
    id: assignment.id,
    expectedRevision: edited.revision_id,
    name: 'Task',
    criteria: [{ name: 'Logic', points: 1 }],
  }).courses[0].assignments[0];
  assert.equal(edited.feedbackLanguage, 'русский');
  const copied = s
    .dispatch('copyCourse', { ...p, ...values, sourceId: p.courseId, name: 'Copy' })
    .courses.find((c) => c.id !== p.courseId);
  assert.equal(copied.assignments[0].feedbackLanguage, 'русский');
});

test('completed AI run is offered as a proposal in the review form and summarised in the work row', async (t) => {
  const { s, p, review } = await fixture(t);
  review();
  const empty = s.dispatch('getReview', p);
  assert.equal(empty.aiProposal, null);
  const result = await s.dispatch('runAiCheck', p);
  assert.equal(result.status, 'completed');
  const form = s.dispatch('getReview', p);
  // Mock-поставщик ставит максимум по каждому критерию: 5 + 2.
  assert.equal(form.aiProposal.total, 7);
  assert.equal(form.aiProposal.scores.length, 2);
  assert.ok(
    form.aiProposal.scores.every((sc) => form.criteria.some((c) => c.id === sc.criterionId)),
  );
  assert.ok(form.aiProposal.feedback);
  assert.equal(form.current, null, 'Предложение ИИ не создаёт оценку преподавателя само по себе');
  const work = s.dispatch('state', {}).courses[0].assignments[0].works[0];
  assert.equal(work.aiScore, 7);
  assert.equal(work.aiStatus, 'completed');
  assert.equal(work.teacherScore, null);
  s.dispatch('runFormalChecks', p);
  const checked = s.dispatch('state', {}).courses[0].assignments[0].works[0];
  assert.equal(typeof checked.formal.failed, 'number');
});
