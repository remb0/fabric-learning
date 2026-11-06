const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const extraSource = fs.readFileSync(path.join(root, 'questions-extra.js'), 'utf8');
const expandedSource = fs.readFileSync(path.join(root, 'questions-expanded.js'), 'utf8');
const masterySource = fs.readFileSync(path.join(root, 'questions-mastery.js'), 'utf8');
const referenceSource = fs.readFileSync(path.join(root, 'question-references.js'), 'utf8');
const certificationSource = fs.readFileSync(path.join(root, 'certifications.js'), 'utf8');
const dp700Match = html.match(/const DP700_QUESTIONS = (\[.*?\]);\n    for\(const bank/s);
assert.ok(dp700Match, 'DP-700 question bank should be embedded in the app');
const dp700 = JSON.parse(dp700Match[1]);
const sandbox = { window: {} };
vm.runInNewContext(extraSource, sandbox, { timeout: 1000 });
vm.runInNewContext(certificationSource, sandbox, { timeout: 1000 });
vm.runInNewContext(expandedSource, sandbox, { timeout: 1000 });
vm.runInNewContext(masterySource, sandbox, { timeout: 1000 });
vm.runInNewContext(referenceSource, sandbox, { timeout: 1000 });
for (const bank of [sandbox.window.QUESTION_ENRICHMENT, sandbox.window.QUESTION_MASTERY]) {
  for (const [exam, additions] of Object.entries(bank)) {
    if (exam === 'dp700') dp700.push(...additions);
    else sandbox.window.EXTRA_QUESTION_BANKS[exam].push(...additions);
  }
}
for (const [exam, references] of Object.entries(sandbox.window.QUESTION_REFERENCE_OVERRIDES)) {
  const questions = exam === 'dp700' ? dp700 : sandbox.window.EXTRA_QUESTION_BANKS[exam];
  for (const q of questions) if (references[q.id]) q.sources = [...(q.sources || []), references[q.id]];
}
const banks = { dp600: sandbox.window.EXTRA_QUESTION_BANKS.dp600, dp700, dp800: sandbox.window.EXTRA_QUESTION_BANKS.dp800, dp900: sandbox.window.EXTRA_QUESTION_BANKS.dp900 };
const expectedDomains = {
  dp600: ['manage', 'prepare', 'model', 'analyze'],
  dp700: ['beheer', 'data', 'monitor'],
  dp800: ['beheer', 'data', 'monitor'],
  dp900: ['core', 'relational', 'nonrelational', 'analytics'],
};

test('all four exam tracks have a question bank and distinct domain coverage', () => {
  assert.deepEqual(Object.keys(banks).sort(), ['dp600', 'dp700', 'dp800', 'dp900']);
  for (const [exam, questions] of Object.entries(banks)) {
    assert.ok(questions.length >= 50, `${exam} should have at least 50 practice questions`);
    assert.equal(new Set(questions.map(q => q.id)).size, questions.length, `${exam} question IDs should be unique`);
    assert.deepEqual([...new Set(questions.map(q => q.domain))].sort(), [...expectedDomains[exam]].sort(), `${exam} should cover every configured exam domain`);
    for (const q of questions) {
      assert.ok(q.stem && q.topic && q.explanation && (q.source || q.sources?.length), `${exam}/${q.id} needs a stem, topic, explanation and source`);
      assert.ok(q.explanation.length >= 120, `${exam}/${q.id} needs a substantial teaching explanation`);
      assert.ok((q.explanation.match(/[.!?](?:\s|$)/g) || []).length >= 2, `${exam}/${q.id} explanation should teach in multiple sentences`);
      assert.ok(Array.isArray(q.options) && q.options.length >= 2, `${exam}/${q.id} needs answer options`);
      assert.ok(Array.isArray(q.correct) && q.correct.length > 0, `${exam}/${q.id} needs a correct answer`);
      assert.ok(q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length), `${exam}/${q.id} answer indices must point to options`);
      const links = [...(q.source ? [{ title: q.sourceTitle || 'Exam objectives', url: q.source }] : []), ...(q.sources || [])];
      assert.ok(links.length >= 1, `${exam}/${q.id} should include at least one source link`);
      assert.ok(q.sources?.length || !q.source?.includes('/study-guides/'), `${exam}/${q.id} needs a topic-specific further-reading source in addition to the exam guide`);
      for (const link of links) {
        assert.ok(link.title && /^https:\/\//.test(link.url), `${exam}/${q.id} has an invalid source link`);
      }
    }
    const supporting = questions.filter(q => (q.sources || []).some(source => !source.url.includes('learn.microsoft.com')));
    assert.ok(supporting.length >= 8, `${exam} should use supporting sources beyond Microsoft Learn throughout the bank`);
  }
});

test('exam selection, per-exam progress and simulation length are wired into the app', () => {
  assert.deepEqual(Object.keys(sandbox.window.EXAM_CERTIFICATIONS).sort(), Object.keys(banks).sort());
  for (const exam of Object.keys(banks)) {
    assert.ok(sandbox.window.EXAM_CERTIFICATIONS[exam], `${exam} should be available in certification configuration`);
    assert.ok(sandbox.window.EXAM_CERTIFICATIONS[exam].duration > 0, `${exam} should define its simulation duration`);
  }
  assert.match(html, /data-cert=/, 'home screen should render exam-choice tiles');
  assert.match(html, /examChosen:false/, 'the app should require an explicit exam choice after opening');
  assert.match(html, /!state\.examId\|\|!state\.examChosen/, 'saved progress should not bypass the exam chooser');
  assert.match(html, /progressByExam/);
  assert.match(html, /Math\.min\(45,pool\.length\)/, 'simulations must not claim more questions than the bank contains');
  assert.match(html, /function balanced\(pool,desired\).*Object\.keys\(DOMAINS\)/, 'balanced selection must support exam tracks with different domain counts');
});

test('activity schema limits reads to administrators and writes to the owning user', () => {
  const migration = fs.readFileSync(path.join(root, 'pb_migrations/1793570000_learning_activity.js'), 'utf8');
  assert.match(migration, /listRule: '@request\.auth\.role = "admin"'/);
  assert.match(migration, /viewRule: '@request\.auth\.role = "admin"'/);
  assert.match(migration, /createRule: '@request\.auth\.id != "" && @request\.body\.user = @request\.auth\.id'/);
  assert.match(migration, /updateRule: '@request\.auth\.id != "" && user = @request\.auth\.id && @request\.body\.user = @request\.auth\.id'/);
});

test('guest question limit and improvement suggestions are enforced', () => {
  assert.match(html, /const GUEST_LIMIT=2/);
  assert.match(html, /guestLimitReached\(\).*openAccount\('limit'\)/s);
  assert.match(html, /recordGuestAnswer\(\)/);
  assert.match(html, /id="suggestion-dialog"/);
  assert.match(html, /collections\/improvement_suggestions\/records/);

  const migration = fs.readFileSync(path.join(root, 'pb_migrations/1793571000_improvement_suggestions.js'), 'utf8');
  assert.match(migration, /name: 'improvement_suggestions'/);
  assert.match(migration, /listRule: '@request\.auth\.role = "admin"'/);
  assert.match(migration, /@request\.body\.status:isset = false/);
  assert.match(migration, /@request\.body\.user:isset = false/);
});

test('Docker image includes the question banks, hooks and PocketBase migrations', () => {
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  const deployScript = fs.readFileSync(path.join(root, 'deploy.sh'), 'utf8');
  assert.match(dockerfile, /certifications\.js/);
  assert.match(dockerfile, /questions-extra\.js/);
  assert.match(dockerfile, /questions-expanded\.js/);
  assert.match(dockerfile, /questions-mastery\.js/);
  assert.match(dockerfile, /question-references\.js/);
  assert.match(dockerfile, /COPY --chown=pocketbase:pocketbase pb_migrations/);
  assert.match(dockerfile, /COPY --chown=pocketbase:pocketbase pb_hooks/);
  assert.match(deployScript, /test -s \/app\/pb_public\/questions-mastery\.js/);
});
