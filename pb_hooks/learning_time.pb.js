routerAdd('POST', '/api/learning-time/pulse', (e) => {
  const body = e.requestInfo().body;
  const exam = String(body.exam || '');
  const token = String(body.token || '');
  const sequence = Number(body.sequence);
  const requested = Number(body.seconds);
  if (!/^(dp600|dp700|dp800|dp900)$/.test(exam) ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(token) ||
      !Number.isSafeInteger(sequence) || sequence < 1 ||
      !Number.isFinite(requested) || requested < 0 || requested > 30) {
    return e.json(400, { message: 'Invalid learning time interval.' });
  }
  const helpers = require(`${__hooks}/lib/learning_time.js`);
  const user = e.auth.id;
  let accepted = 0;
  let since = '';
  e.app.runInTransaction((app) => {
    const now = Date.now();
    let clock = app.findRecordsByFilter('learning_clock', 'user = {:user}', '', 1, 0, { user })[0];
    if (!clock) {
      clock = new Record(app.findCollectionByNameOrId('learning_clock'));
      clock.set('user', user);
    }
    const tokens = JSON.parse(clock.getString('tokens') || '{}') || {};
    const previous = tokens[token];
    if (previous && sequence <= previous.sequence) return;
    accepted = helpers.creditedSeconds(requested, now, previous ? previous.at : 0, clock.getFloat('checkpoint'));
    // One account-wide checkpoint caps overlapping tabs/devices to wall-clock time.
    clock.set('checkpoint', now);
    tokens[token] = { sequence, at: now };
    for (const key of Object.keys(tokens)) if (now - tokens[key].at > 86400000) delete tokens[key];
    if (Object.keys(tokens).length > 200) {
      const oldest = Object.keys(tokens).sort((a, b) => tokens[a].at - tokens[b].at);
      while (oldest.length > 200) delete tokens[oldest.shift()];
    }
    clock.set('tokens', tokens);
    app.save(clock);
    since = clock.getString('created');
    const days = helpers.splitDays(now, accepted);
    for (const day of Object.keys(days)) {
      let total = app.findRecordsByFilter('learning_time', 'user = {:user} && exam = {:exam} && day = {:day}', '', 1, 0, { user, exam, day })[0];
      if (!total) {
        total = new Record(app.findCollectionByNameOrId('learning_time'));
        total.set('user', user); total.set('exam', exam); total.set('day', day);
      }
      total.set('seconds', total.getFloat('seconds') + days[day]);
      app.save(total);
    }
  });
  return e.json(200, { seconds: accepted, since });
}, $apis.requireAuth('users'));

routerAdd('GET', '/api/learning-time/summary', (e) => {
  const all = e.request.url.query().get('all') === '1';
  if (all && e.auth.getString('role') !== 'admin') return e.json(403, { message: 'Administrator access required.' });
  const filter = all ? '' : 'user = {:user}';
  const params = { user: e.auth.id };
  const rows = e.app.findRecordsByFilter('learning_time', filter, '-day', 0, 0, params);
  const clocks = e.app.findRecordsByFilter('learning_clock', filter, 'created', 0, 0, params);
  return e.json(200, {
    rows: rows.map(r => ({ user: r.getString('user'), exam: r.getString('exam'), day: r.getString('day'), seconds: r.getFloat('seconds') })),
    since: clocks.length ? clocks[0].getString('created') : '',
    timezone: 'Europe/Amsterdam',
  });
}, $apis.requireAuth('users'));
