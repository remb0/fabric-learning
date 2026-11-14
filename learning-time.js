/* Active learning time. Totals are accepted and stored by the server. */
window.LearningTime = class {
  constructor({ getState, api, tr, safe, save }) {
    Object.assign(this, { getState, api, tr, safe, save });
    this.token = crypto.randomUUID(); this.sequence = 0;
    this.lastInput = performance.now(); this.lastTick = performance.now();
    this.pending = 0; this.context = null; this.primed = false;
    this.rows = []; this.since = ''; this.owner = ''; this.error = false;
    for (const event of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
      document.addEventListener(event, () => { this.tick(); this.lastInput = performance.now(); }, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => { this.tick(); this.flush(); });
    window.addEventListener('pagehide', () => { this.tick(); this.flush(); });
    setInterval(() => this.tick(), 1000);
    setInterval(() => this.flush(), 15000);
  }
  recent() { return document.visibilityState === 'visible' && performance.now() - this.lastInput < 120000; }
  learningContext() {
    const s = this.getState();
    if (!s.user || !s.examChosen || s.about || s.adminPage || !s.session) return null;
    if (!document.querySelector('#main .quiz-card, #main .result-hero')) return null;
    if (document.querySelector('dialog[open]')) return null;
    return { user: s.user.id, exam: s.examId, session: s.session };
  }
  tick() {
    const now = performance.now(), s = this.getState();
    if (this.owner !== (s.user?.id || '')) {
      this.owner = s.user?.id || ''; this.context = null; this.pending = 0;
      this.rows = []; this.since = ''; this.primed = false; this.error = false;
      this.token = crypto.randomUUID(); this.sequence = 0;
      if (s.user) this.refresh();
    }
    const context = this.learningContext();
    const same = context && this.context && context.user === this.context.user && context.exam === this.context.exam && context.session === this.context.session;
    if (!same) {
      this.flush(); this.pending = 0; this.primed = false; this.context = context;
    } else if (this.recent() && now - this.lastTick < 5000 && this.primed) {
      this.pending = Math.min(30, this.pending + Math.max(0, Math.min(now, this.lastInput + 120000) - this.lastTick) / 1000);
    }
    if (!this.recent() && this.pending <= 0 && !this.busy) this.primed = false;
    this.lastTick = now;
    if (context && !this.primed && !this.busy && this.recent()) this.flush();
    const el = document.getElementById('learning-live');
    if (el) el.textContent = !s.user ? this.tr('Meld je aan om actieve leertijd bij te houden.','Sign in to track active learning time.') : this.error ? this.tr('Tijdregistratie tijdelijk niet beschikbaar','Time tracking temporarily unavailable') :
      `${this.tr('Actieve tijd deze sessie','Active time this session')}: ${this.format(s.session?.activeSeconds || 0)} · ${this.recent() ? this.tr('loopt','running') : this.tr('gepauzeerd','paused')}`;
  }
  async flush() {
    if (this.busy || !this.context || !this.getState().user || this.context.user !== this.getState().user.id) return;
    if (!this.primed && !this.recent()) return;
    if (this.primed && this.pending <= 0) return;
    const context = this.context, seconds = this.primed ? this.pending : 0;
    this.pending = 0; this.busy = true;
    try {
      const result = await this.api('/learning-time/pulse', { method: 'POST', keepalive: true,
        body: JSON.stringify({ exam: context.exam, token: this.token, sequence: ++this.sequence, seconds }) });
      if (this.owner !== context.user || this.getState().user?.id !== context.user) return;
      if (this.context === context) this.primed = this.recent();
      this.error = false;
      if (result.seconds > 0) {
        context.session.activeSeconds = (context.session.activeSeconds || 0) + result.seconds;
        this.save();
      }
    } catch { this.error = true; this.primed = false; }
    finally { this.busy = false; }
  }
  async refresh() {
    const owner = this.getState().user?.id;
    if (!owner) return;
    try {
      const result = await this.api('/learning-time/summary');
      if (this.getState().user?.id !== owner) return;
      this.rows = result.rows || []; this.since = result.since || ''; this.summaryError = false;
    } catch { this.summaryError = true; }
    this.renderSummaries();
  }
  day(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
  week() {
    const today = this.day(), date = new Date(today + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date.toISOString().slice(0, 10);
  }
  format(seconds) {
    if (seconds > 0 && seconds < 60) return '<1 min';
    const minutes = Math.floor(seconds / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)} ${this.tr('u','h')} ${minutes % 60} min` : `${minutes} min`;
  }
  totals(rows) {
    const today = this.day(), week = this.week();
    return { today: rows.filter(r => r.day === today).reduce((a,r) => a+r.seconds,0),
      week: rows.filter(r => r.day >= week && r.day <= today).reduce((a,r) => a+r.seconds,0),
      total: rows.reduce((a,r) => a+r.seconds,0) };
  }
  summary(exam = '') {
    const t = this.tr;
    if (this.summaryError) return `<p class="help">${t('Leertijd kon niet worden geladen.','Could not load learning time.')}</p>`;
    const totals = this.totals(this.rows.filter(r => !exam || r.exam === exam));
    return `<strong>${t('Actieve leertijd','Active learning time')}</strong><div class="history">${[
      [t('Vandaag','Today'), totals.today], [t('Deze week','This week'), totals.week], [t('Totaal','Total'), totals.total],
    ].map(([label, seconds]) => `<div class="history-entry"><span>${label}</span><strong>${this.format(seconds)}</strong></div>`).join('')}</div><p class="help">${this.since ? `${t('Bijgehouden sinds','Tracked since')} ${this.safe(new Date(this.since).toLocaleDateString())}.` : t('De meting begint zodra je ingelogd oefent.','Tracking starts when you practice while signed in.')} ${t('Pauzeert bij een verborgen tabblad of na 2 minuten zonder interactie. Dagen volgen Amsterdamse tijd.','Pauses in a hidden tab or after 2 minutes without interaction. Days use Amsterdam time.')}</p>`;
  }
  renderSummaries() {
    for (const el of document.querySelectorAll('[data-learning-summary]')) el.innerHTML = this.summary(el.dataset.learningSummary);
    for (const el of document.querySelectorAll('[data-learning-exam]')) {
      el.textContent = this.format(this.totals(this.rows.filter(r => r.exam === el.dataset.learningExam)).total);
    }
  }
  async renderAdmin(users) {
    const target = document.getElementById('learning-admin');
    if (!target) return;
    const t = this.tr, safe = this.safe;
    target.innerHTML = `<p class="help">${t('Leertijd laden…','Loading learning time…')}</p>`;
    try {
      const result = await this.api('/learning-time/summary?all=1');
      if (!target.isConnected) return;
      const exams = Object.keys(window.EXAM_CERTIFICATIONS);
      target.innerHTML = `<h2>${t('Actieve leertijd per gebruiker','Active learning time by user')}</h2><div class="controls"><div class="field"><label for="learning-search">${t('Zoek gebruiker','Find user')}</label><input id="learning-search" type="search" placeholder="${t('E-mailadres','Email address')}"></div><div class="field"><label for="learning-period">${t('Periode','Period')}</label><select id="learning-period"><option value="all">${t('Alles','All time')}</option><option value="today">${t('Vandaag','Today')}</option><option value="week">${t('Deze week','This week')}</option></select></div><div class="field"><label for="learning-exam">${t('Examen','Exam')}</label><select id="learning-exam"><option value="">${t('Alle examens','All exams')}</option>${exams.map(exam => `<option value="${exam}">${exam.toUpperCase()}</option>`).join('')}</select></div><button id="learning-refresh" type="button" class="secondary">${t('Verversen','Refresh')}</button></div><p class="help">${t('Klik op een gebruiker voor leertijd per dag en examen. Dagen volgen Amsterdamse tijd.','Select a user for time by day and exam. Days use Amsterdam time.')} ${result.since ? `${t('Bijgehouden sinds','Tracked since')} ${safe(new Date(result.since).toLocaleDateString())}.` : t('Nog geen leertijd geregistreerd.','No learning time recorded yet.')}</p><div id="learning-table" class="table-wrap"></div><div id="learning-detail"></div>`;
      const render = () => {
        const search = document.getElementById('learning-search').value.toLowerCase();
        const period = document.getElementById('learning-period').value;
        const exam = document.getElementById('learning-exam').value;
        const start = period === 'today' ? this.day() : period === 'week' ? this.week() : '';
        const rows = result.rows.filter(r => (!exam || r.exam === exam) && (!start || r.day >= start));
        const selected = users.filter(u => (u.email || '').toLowerCase().includes(search));
        document.getElementById('learning-detail').innerHTML = '';
        document.getElementById('learning-table').innerHTML = `<table class="admin-table"><thead><tr><th>${t('Gebruiker','User')}</th><th>${t('Vandaag','Today')}</th><th>${t('Deze week','This week')}</th><th>${t('Totaal in periode','Total in period')}</th></tr></thead><tbody>${selected.map(u => {
          const totals = this.totals(rows.filter(r => r.user === u.id));
          return `<tr><td><button class="text-btn" data-learning-user="${safe(u.id)}">${safe(u.email)}</button></td><td>${this.format(totals.today)}</td><td>${this.format(totals.week)}</td><td>${this.format(totals.total)}</td></tr>`;
        }).join('') || `<tr><td colspan="4">${t('Geen gebruikers gevonden.','No users found.')}</td></tr>`}</tbody></table>`;
        for (const button of document.querySelectorAll('[data-learning-user]')) button.onclick = () => {
          const user = selected.find(u => u.id === button.dataset.learningUser);
          const detail = rows.filter(r => r.user === user.id);
          document.getElementById('learning-detail').innerHTML = `<h3>${safe(user.email)}</h3><table class="admin-table"><thead><tr><th>${t('Dag','Day')}</th><th>${t('Examen','Exam')}</th><th>${t('Actieve tijd','Active time')}</th></tr></thead><tbody>${detail.map(r => `<tr><td>${safe(r.day)}</td><td>${safe(r.exam.toUpperCase())}</td><td>${this.format(r.seconds)}</td></tr>`).join('') || `<tr><td colspan="3">${t('Nog geen leertijd in deze periode.','No learning time in this period.')}</td></tr>`}</tbody></table>`;
        };
      };
      for (const id of ['learning-search', 'learning-period', 'learning-exam']) document.getElementById(id).oninput = render;
      document.getElementById('learning-refresh').onclick = () => this.renderAdmin(users);
      render();
    } catch { target.textContent = t('Leertijd kon niet worden geladen. Vernieuw de pagina om het opnieuw te proberen.','Could not load learning time. Reload the page to try again.'); }
  }
};
