// Europe/Amsterdam changes at 01:00 UTC on the last Sunday in March/October.
function dayKey(ms) {
  const year = new Date(ms).getUTCFullYear();
  const lastSunday = month => {
    const last = new Date(Date.UTC(year, month + 1, 0, 1));
    return last.getTime() - last.getUTCDay() * 86400000;
  };
  const summer = ms >= lastSunday(2) && ms < lastSunday(9);
  return new Date(ms + (summer ? 7200000 : 3600000)).toISOString().slice(0, 10);
}
function creditedSeconds(requested, now, previous, checkpoint) {
  if (!Number.isFinite(requested) || requested < 0) return 0;
  if (!previous || now - previous > 45000) return 0;
  return Math.max(0, Math.min(requested, 30, (now - previous) / 1000, (now - checkpoint) / 1000));
}
function splitDays(now, seconds) {
  const days = {};
  let cursor = now - seconds * 1000;
  while (cursor < now) {
    const end = Math.min(now, Math.floor(cursor / 1000) * 1000 + 1000);
    const key = dayKey(cursor);
    days[key] = (days[key] || 0) + (end - cursor) / 1000;
    cursor = end;
  }
  return days;
}
module.exports = { dayKey, creditedSeconds, splitDays };
