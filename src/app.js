import { fetchRepo, parseRepo, GitHubError } from './github.js';
import { buildStory } from './story.js';
import { inkPortrait } from './halftone.js';
import { drawPage, toSVG, PAGE } from './manga.js';

const $ = s => document.querySelector(s);
const form = $('#form'), input = $('#repo'), stage = $('#stage'), status = $('#status'), actions = $('#actions');
const tokenInput = $('#token');
let current = null;   // { story, page, svgText }

try { tokenInput.value = localStorage.getItem('cm-token') || ''; } catch {}
tokenInput.addEventListener('change', () => { try { localStorage.setItem('cm-token', tokenInput.value.trim()); } catch {} });

const say = (text, kind = '') => { status.textContent = text; status.className = kind; };

async function draw(raw) {
  const repo = parseRepo(raw);
  if (!repo) { say('Type a repository as owner/name, for example facebook/react.', 'err'); input.focus(); return; }
  const key = `${repo.owner}/${repo.name}`;
  input.value = key;
  history.replaceState(null, '', `?repo=${encodeURIComponent(key)}`);
  document.title = `${key} · Commit Manga`;
  form.querySelector('button').disabled = true;
  actions.hidden = true;
  stage.classList.add('busy');
  try {
    say('Reading the history…');
    const cached = sessionStorage.getItem('cm:' + key);
    const data = cached ? JSON.parse(cached) : await fetchRepo(repo, tokenInput.value.trim());
    try { sessionStorage.setItem('cm:' + key, JSON.stringify(data)); } catch {}
    const story = buildStory(data);
    say('Inking the portraits…');
    const people = new Map();
    for (const c of [story.origin, story.drama, story.latest, ...story.crew, ...(story.rush?.authors || [])]) {
      if (c && c.login && c.avatar && !people.has(c.login)) people.set(c.login, c.avatar);
    }
    const portraits = {};
    await Promise.all([...people].map(async ([login, url]) => { portraits[login] = await inkPortrait(url); }));
    const page = drawPage(story, portraits);
    stage.innerHTML = toSVG(page, { animate: true });
    current = { story, page };
    say(`${key}: ${story.totalCommits.toLocaleString('en')} commit${story.totalCommits === 1 ? '' : 's'}, volume ${story.volume}.`, 'ok');
    actions.hidden = false;
  } catch (e) {
    console.error(e);
    say(e instanceof GitHubError ? e.message : 'Something went wrong while drawing. Try again, or try another repository.', 'err');
  } finally {
    form.querySelector('button').disabled = false;
    stage.classList.remove('busy');
  }
}

form.addEventListener('submit', e => { e.preventDefault(); draw(input.value); });
document.querySelectorAll('[data-repo]').forEach(b => b.addEventListener('click', () => draw(b.dataset.repo)));

// ---------------------------------------------------------------- export, with the fonts baked in

let fontCSS = null;
async function embeddedFonts(text) {
  if (fontCSS) return fontCSS;
  const families = [
    ['Bangers', 'https://fonts.googleapis.com/css2?family=Bangers'],
    ['Comic Neue', 'https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,700;1,700'],
    ['Dela Gothic One', `https://fonts.googleapis.com/css2?family=Dela+Gothic+One&text=${encodeURIComponent(text)}`],
  ];
  const rules = [];
  for (const [, url] of families) {
    const css = await (await fetch(url)).text();
    for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
      const src = /url\(([^)]+)\)/.exec(block)?.[1];
      if (!src) continue;
      const buf = await (await fetch(src)).arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const type = src.includes('.woff2') ? 'woff2' : src.includes('.woff') ? 'woff' : 'truetype';
      rules.push(block.replace(/src:[^;]+;/, `src:url(data:font/${type};base64,${btoa(bin)}) format('${type}');`));
    }
  }
  return (fontCSS = rules.join(''));
}

async function exportSVG() {
  const jp = 'ドガーンギクッキラタラズーンゴンドキドキ';
  return toSVG(current.page, { fontCSS: await embeddedFonts(jp) });
}

function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const slug = () => current.story.full.replace('/', '-');

$('#svg').addEventListener('click', async () => {
  say('Packing the SVG…');
  download(new Blob([await exportSVG()], { type: 'image/svg+xml' }), `${slug()}-manga.svg`);
  say('Saved.', 'ok');
});

$('#png').addEventListener('click', async () => {
  say('Rendering the PNG…');
  const svg = await exportSVG();
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await img.decode();
  await new Promise(r => setTimeout(r, 150));  // let the embedded fonts settle
  const scale = 2, c = document.createElement('canvas');
  c.width = PAGE.w * scale; c.height = PAGE.h * scale;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  c.toBlob(b => { download(b, `${slug()}-manga.png`); say('Saved.', 'ok'); }, 'image/png');
});

$('#link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); say('Link copied. Anyone who opens it gets this page.', 'ok'); }
  catch { say(location.href, 'ok'); }
});

const start = new URLSearchParams(location.search).get('repo');
if (start) draw(start);
