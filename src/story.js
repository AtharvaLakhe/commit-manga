// Turns a repository's history into the beats of one manga chapter.
// Pure functions only, so the story can be tested without a browser or the network.

const DRAMA = [
  [/\brevert/i, 'regret'],
  [/\b(oops|whoops|my bad|mistake)\b/i, 'oops'],
  [/\b(hot ?fix|urgent|critical|asap)\b/i, 'panic'],
  [/\b(finally|at last)\b/i, 'triumph'],
  [/\b(typo|typos)\b/i, 'oops'],
  [/!{2,}/, 'shout'],
  [/\b(wip|tmp|temp|hack|kludge|todo)\b/i, 'sweat'],
  [/\b(why|wtf|broke|broken|again)\b/i, 'despair'],
  [/\b(fix|fixes|fixed)\b/i, 'sweat'],
];

export const SFX = {
  regret: ['ガーン', 'GAAN'],
  oops: ['ギクッ', 'GIKU'],
  panic: ['ドキドキ', 'DOKI DOKI'],
  triumph: ['ドン', 'DON'],
  shout: ['ゴゴゴ', 'GOGOGO'],
  sweat: ['タラ', 'TARA'],
  despair: ['ズーン', 'ZUUN'],
};

export function dayKey(iso) { return (iso || '').slice(0, 10); }

export function busiestDay(commits) {
  const byDay = new Map();
  for (const c of commits) {
    const k = dayKey(c.date);
    if (!k) continue;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(c);
  }
  let best = null;
  for (const [day, list] of byDay) if (!best || list.length > best.commits.length) best = { day, commits: list };
  if (!best) return null;
  const authors = [];
  for (const c of best.commits) {
    const id = c.login || c.name;
    if (!authors.some(a => (a.login || a.name) === id)) authors.push(c);
  }
  return { day: best.day, count: best.commits.length, authors: authors.slice(0, 5) };
}

export function dramaticCommit(commits) {
  for (const [re, mood] of DRAMA) {
    const hit = commits.find(c => re.test(c.message) && c.message.length > 3);
    if (hit) return { ...hit, mood };
  }
  const shortest = [...commits].filter(c => c.message).sort((a, b) => a.message.length - b.message.length)[0];
  return shortest ? { ...shortest, mood: 'sweat' } : null;
}

export function crewOf(data) {
  if (data.contributors.length) return data.contributors.slice(0, 5);
  const counts = new Map();
  for (const c of data.recent) {
    if (/(\[bot\]|-bot)$/i.test(c.login || '')) continue;
    const id = c.login || c.name;
    const e = counts.get(id) || { login: c.login || c.name, avatar: c.avatar, commits: 0 };
    e.commits++;
    counts.set(id, e);
  }
  return [...counts.values()].sort((a, b) => b.commits - a.commits).slice(0, 5);
}

export function volume(created, now = new Date()) {
  const years = (now - new Date(created)) / (365.25 * 864e5);
  return Math.max(1, Math.ceil(years));
}

export function compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function buildStory(data, now = new Date()) {
  const recent = data.recent.filter(c => c.message);
  return {
    title: data.full.split('/')[1],
    owner: data.full.split('/')[0],
    full: data.full,
    url: data.url,
    tagline: data.description,
    volume: volume(data.created, now),
    stars: data.stars,
    forks: data.forks,
    language: data.language,
    totalCommits: data.totalCommits,
    origin: data.first,
    crew: crewOf(data),
    rush: busiestDay(recent),
    drama: dramaticCommit(recent.slice(1)),  // not the newest: that one closes the chapter
    release: data.releases[0] || null,
    latest: recent[0] || data.first,
  };
}

// Split text into lines of at most `max` characters, breaking long words if it has to.
export function wrap(text, max, maxLines = 4) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (let w of words) {
    while (w.length > max) {
      if (line) { lines.push(line); line = ''; }
      lines.push(w.slice(0, max - 1) + '-');
      w = w.slice(max - 1);
    }
    if (!line) line = w;
    else if ((line + ' ' + w).length <= max) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.{0,3}$/, '') + '…';
    return kept;
  }
  return lines;
}
