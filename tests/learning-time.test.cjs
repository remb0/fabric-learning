const test = require('node:test');
const assert = require('node:assert/strict');
const { dayKey, creditedSeconds, splitDays } = require('../pb_hooks/lib/learning_time.js');

test('server caps credit, ignores stale timers, and prevents overlapping device time', () => {
  assert.equal(creditedSeconds(15, 60000, 45000, 45000), 15);
  assert.equal(creditedSeconds(15, 60000, 45000, 55000), 5);
  assert.equal(creditedSeconds(30, 60000, 59000, 55000), 1);
  assert.equal(creditedSeconds(30, 90000, 1000, 1000), 0);
  assert.equal(creditedSeconds(30, 60000, 0, 45000), 0);
  assert.equal(creditedSeconds(-1, 60000, 45000, 45000), 0);
  assert.equal(creditedSeconds(NaN, 60000, 45000, 45000), 0);
  assert.equal(creditedSeconds(10000, 60000, 20000, 20000), 30);
});

test('daily buckets follow Amsterdam midnight and both daylight saving transitions', () => {
  assert.equal(dayKey(Date.parse('2026-11-13T23:30:00Z')), '2026-11-14');
  assert.equal(dayKey(Date.parse('2026-07-01T22:30:00Z')), '2026-07-02');
  assert.deepEqual(splitDays(Date.parse('2026-11-13T23:00:05Z'), 15), { '2026-11-13': 10, '2026-11-14': 5 });
  assert.deepEqual(splitDays(Date.parse('2026-07-01T22:00:05Z'), 15), { '2026-07-01': 10, '2026-07-02': 5 });
  for (const end of ['2026-03-29T01:00:05Z', '2026-10-25T01:00:05Z']) {
    assert.equal(Object.values(splitDays(Date.parse(end), 15.75)).reduce((a,b) => a+b,0), 15.75);
  }
});

const vm = require('node:vm');
const fs = require('node:fs');
function trackerFixture() {
  let time = 0, visible = true, screen = true, dialog = false;
  const state = { user: { id: 'one' }, examChosen: true, examId: 'dp700', session: {} };
  const listeners = {};
  const doc = { addEventListener: (name,fn) => { listeners[name] = fn; },
    get visibilityState() { return visible ? 'visible' : 'hidden'; },
    querySelector: selector => selector === 'dialog[open]' ? dialog : screen,
    querySelectorAll: () => [], getElementById: () => null };
  const calls = [];
  const context = { window: { addEventListener() {} }, document: doc, performance: { now: () => time },
    crypto: { randomUUID: () => 'test-token-1234567890' }, setInterval() {}, Intl, Date };
  vm.runInNewContext(fs.readFileSync(require.resolve('../learning-time.js'), 'utf8'), context);
  const tracker = new context.window.LearningTime({ getState: () => state, tr: (nl,en) => en, safe: x => x, save() {},
    api: async (path,options) => {
      if (!options) return { rows: [] };
      const body = JSON.parse(options.body); calls.push(body);
      return { seconds: body.seconds };
    } });
  return { tracker, state, calls, listeners, advance: async (seconds) => {
    for (let i=0;i<seconds;i++) { time+=1000; tracker.tick(); await new Promise(r => setImmediate(r)); }
  }, hide: () => { visible=false; }, show: () => { visible=true; }, dialog: () => { dialog=true; } };
}

test('client counts visible practice, pauses hidden and idle, and resumes on interaction', async () => {
  const f = trackerFixture();
  f.tracker.tick(); await new Promise(r => setImmediate(r));
  await f.advance(15); await f.tracker.flush();
  assert.equal(f.state.session.activeSeconds, 15);
  f.hide(); await f.advance(15); await f.tracker.flush();
  assert.equal(f.state.session.activeSeconds, 15);
  f.show(); await f.advance(100); await f.tracker.flush();
  const before = f.state.session.activeSeconds;
  await f.advance(20); await f.tracker.flush();
  assert.equal(f.state.session.activeSeconds, before);
  f.listeners.pointerdown(); f.tracker.tick(); await new Promise(r => setImmediate(r)); await f.advance(5); await f.tracker.flush();
  assert.equal(f.state.session.activeSeconds, before + 5);
});

test('user totals preserve seconds, Monday week boundaries, and per-exam separation', () => {
  const { tracker } = trackerFixture();
  tracker.day = () => '2026-11-16'; tracker.week = () => '2026-11-16';
  const rows = [{ exam: 'dp700', day: '2026-11-15', seconds: 30 },
    { exam: 'dp700', day: '2026-11-16', seconds: 45 },
    { exam: 'dp600', day: '2026-11-16', seconds: 60 }];
  assert.equal(tracker.totals(rows).today, 105);
  assert.equal(tracker.totals(rows).week, 105);
  assert.equal(tracker.totals(rows).total, 135);
  assert.equal(tracker.totals(rows.filter(r => r.exam === 'dp700')).total, 75);
  assert.equal(tracker.format(45), '<1 min');
  assert.equal(tracker.format(3661), '1 h 1 min');
});

test('client excludes dialogs and administration and never transfers previous account time', async () => {
  const f = trackerFixture(); f.tracker.tick(); await new Promise(r => setImmediate(r));
  await f.advance(5); f.dialog(); await f.advance(5); await f.tracker.flush();
  assert.equal(f.state.session.activeSeconds, 5);
  f.state.adminPage = true; await f.advance(5); await f.tracker.flush();
  assert.equal(f.state.session.activeSeconds, 5);
  f.state.user = { id: 'two' }; f.state.session = {}; await f.advance(2);
  assert.equal(f.tracker.pending, 0); assert.equal(f.tracker.rows.length, 0);
});

test('real PocketBase migration, ownership, deduplication and admin totals', { skip: !process.env.PB_TEST_URL }, async () => {
  const base = process.env.PB_TEST_URL;
  async function api(path, token, method='GET', body) {
    const res = await fetch(base + '/api/' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const raw = await res.text(); return { status: res.status, data: raw ? JSON.parse(raw) : {} };
  }
  const suffix = Date.now();
  const password = 'Local-test-only-2398!';
  const auth = await api('collections/_superusers/auth-with-password', '', 'POST', { identity: 'test-admin@example.invalid', password });
  assert.equal(auth.status, 200);
  const superToken = auth.data.token;
  const users = [];
  try {
    for (const name of ['one', 'two', 'admin']) {
      const created = await api('collections/users/records', '', 'POST', { email: `${name}-${suffix}@example.invalid`, password, passwordConfirm: password });
      assert.equal(created.status, 200); users.push(created.data);
    }
    assert.equal((await api(`collections/users/records/${users[2].id}`, superToken, 'PATCH', { role: 'admin' })).status, 200);
    const tokens = [];
    for (const u of users) tokens.push((await api('collections/users/auth-with-password', '', 'POST', { identity: u.email, password })).data.token);
    assert.equal((await api('learning-time/summary')).status, 401);
    assert.equal((await api('learning-time/summary?all=1', tokens[0])).status, 403);
    assert.equal((await api('collections/learning_time/records', tokens[0], 'POST', { user: users[0].id, exam: 'dp700', day: '2026-11-14', seconds: 999 })).status, 403);
    assert.equal((await api('learning-time/pulse', tokens[0], 'POST', { exam: 'bad', token: 'test-token-1234567890', sequence: 1, seconds: 0 })).status, 400);
    const body = { exam: 'dp700', token: 'test-token-1234567890', sequence: 1, seconds: 0 };
    let pulse = await api('learning-time/pulse', tokens[0], 'POST', body);
    assert.equal(pulse.status, 200, JSON.stringify(pulse.data)); assert.equal(pulse.data.seconds, 0);
    await new Promise(r => setTimeout(r, 1100));
    body.sequence = 2; body.seconds = 30;
    pulse = await api('learning-time/pulse', tokens[0], 'POST', body);
    assert.equal(pulse.status, 200, JSON.stringify(pulse.data));
    assert.ok(pulse.data.seconds >= 1 && pulse.data.seconds < 3, JSON.stringify(pulse.data));
    const recorded = pulse.data.seconds;
    assert.equal((await api('learning-time/pulse', tokens[0], 'POST', body)).data.seconds, 0);
    const otherDevice = { ...body, token: 'another-device-123456', sequence: 1 };
    assert.equal((await api('learning-time/pulse', tokens[0], 'POST', otherDevice)).data.seconds, 0);
    assert.equal((await api('learning-time/summary', tokens[1])).data.rows.length, 0);
    const own = await api('learning-time/summary', tokens[0]);
    assert.equal(own.data.rows.length, 1); assert.equal(own.data.rows[0].seconds, recorded);
    assert.equal((await api('learning-time/summary?all=1', tokens[2])).data.rows.find(r => r.user === users[0].id).seconds, recorded);
    const privateRows = await api('collections/learning_clock/records', tokens[0]);
    assert.ok(privateRows.status === 403 || privateRows.data.items.length === 0);
    const activity = await api('collections/learning_activity/records', tokens[0], 'POST', { user: users[0].id, exam: 'dp700', activity: 'Practice', last_seen: new Date().toISOString() });
    assert.equal(activity.status, 200);
    const recordPath = `collections/learning_activity/records/${activity.data.id}`;
    assert.equal((await api(recordPath, tokens[0])).status, 200);
    assert.equal((await api(recordPath, tokens[1])).status, 404);
    assert.equal((await api(recordPath, tokens[0], 'PATCH', { user: users[0].id, activity: 'Reading' })).status, 200);
    const timeRows = await api('collections/learning_time/records', tokens[0]);
    assert.equal((await api(`collections/learning_time/records/${timeRows.data.items[0].id}`, tokens[0], 'PATCH', { seconds: 99999 })).status, 403);
    await api(`collections/users/records/${users[0].id}`, superToken, 'DELETE');
    assert.equal((await api(`collections/learning_time/records?filter=${encodeURIComponent(`user="${users[0].id}"`)}`, superToken)).data.items.length, 0);
  } finally {
    for (const user of users) await api(`collections/users/records/${user.id}`, superToken, 'DELETE');
  }
});
