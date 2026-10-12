// Draws one manga page from a story: seven panels, read left to right, top to bottom.
// Everything is SVG; portraits arrive as halftoned PNG data URLs.

import { SFX, compact, wrap } from './story.js';

export const PAGE = { w: 1000, h: 1500 };
const INK = '#0b0b0b', PAPER = '#fbfaf6';

// panel outlines: gutters are white, some edges are slanted for movement
const PANELS = {
  title:   [[26, 26], [974, 26], [974, 292], [26, 318]],
  origin:  [[26, 332], [548, 306], [548, 690], [26, 690]],
  crew:    [[562, 306], [974, 306], [974, 690], [562, 690]],
  rush:    [[26, 704], [974, 704], [974, 984], [26, 1010]],
  drama:   [[26, 1024], [486, 998], [486, 1300], [26, 1300]],
  release: [[500, 997], [974, 970], [974, 1300], [500, 1300]],
  latest:  [[26, 1314], [974, 1314], [974, 1474], [26, 1474]],
};

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n1 = v => Math.round(v * 10) / 10;
const pts = p => p.map(([x, y]) => `${n1(x)},${n1(y)}`).join(' ');
const bbox = p => {
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
const monthYear = iso => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const dayMonth = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// a seeded random source, so the same repo always draws the same page
function rng(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------------------------------------------------------------- manga vocabulary

function focusLines(r, cx, cy, rx, ry, n, fill = INK) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - .5) * .03;
    const k = 1 + r() * .6, w = .004 + r() * .012, reach = 1400;
    d += `M${n1(cx + Math.cos(a) * rx * k)},${n1(cy + Math.sin(a) * ry * k)}` +
      `L${n1(cx + Math.cos(a + w) * reach)},${n1(cy + Math.sin(a + w) * reach)}` +
      `L${n1(cx + Math.cos(a - w) * reach)},${n1(cy + Math.sin(a - w) * reach)}Z`;
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

function speedLines(r, box, n, fill = INK) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const y = box.y + r() * box.h, x = box.x - 60 + r() * (box.w + 60), len = 80 + r() * 320, w = .4 + r() * 1.6;
    d += `M${n1(x)},${n1(y)}L${n1(x + len)},${n1(y - w)}L${n1(x + len)},${n1(y + w)}Z`;
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

function gloomLines(r, box, n) {  // the vertical lines that hang over a character in despair
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = box.x + r() * box.w, len = box.h * (.2 + r() * .5);
    d += `M${n1(x)},${n1(box.y)}V${n1(box.y + len)}`;
  }
  return `<path d="${d}" stroke="${INK}" stroke-width="1.6" opacity=".75"/>`;
}

function textLines(lines, x, y, size, { family = 'Comic Neue', weight = 700, anchor = 'middle', fill = INK, lh = 1.18 } = {}) {
  const top = y - ((lines.length - 1) * size * lh) / 2;
  return lines.map((l, i) =>
    `<text x="${n1(x)}" y="${n1(top + i * size * lh)}" font-family="${family}" font-weight="${weight}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="middle" fill="${fill}">${esc(l)}</text>`).join('');
}

function bubble(cx, cy, rx, ry, tail, text, size = 22) {
  const maxChars = Math.max(8, Math.floor((rx * 1.55) / (size * .55)));
  const lines = wrap(text, maxChars, Math.max(1, Math.floor((ry * 1.5) / (size * 1.18))));
  const [tx, ty] = tail;
  const a = Math.atan2(ty - cy, tx - cx), spread = .22;
  const base1 = [cx + Math.cos(a - spread) * rx * .92, cy + Math.sin(a - spread) * ry * .92];
  const base2 = [cx + Math.cos(a + spread) * rx * .92, cy + Math.sin(a + spread) * ry * .92];
  return `<g class="bub"><path d="M${n1(base1[0])},${n1(base1[1])}L${n1(tx)},${n1(ty)}L${n1(base2[0])},${n1(base2[1])}Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M${n1(base1[0])},${n1(base1[1])}L${n1(base2[0])},${n1(base2[1])}" stroke="#fff" stroke-width="5"/>` +
    textLines(lines, cx, cy, size) + '</g>';
}

function thought(r, cx, cy, rx, ry, toward, text, size = 21) {
  let lobes = '';
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = 26 + r() * 14;
    lobes += `<circle cx="${n1(cx + Math.cos(a) * rx * .88)}" cy="${n1(cy + Math.sin(a) * ry * .82)}" r="${n1(rr)}"/>`;
  }
  const [tx, ty] = toward;
  const trail = [.55, .72, .86].map((t, i) => `<circle cx="${n1(cx + (tx - cx) * t)}" cy="${n1(cy + (ty - cy) * t)}" r="${9 - i * 2.5}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`).join('');
  const lines = wrap(text, Math.floor((rx * 1.6) / (size * .55)), 3);
  return `<g class="bub">${trail}<g fill="#fff" stroke="${INK}" stroke-width="5">${lobes}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></g>` +
    `<g fill="#fff">${lobes}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></g>` + textLines(lines, cx, cy, size) + '</g>';
}

function caption(x, y, text, { size = 18, maxChars = 34, anchor = 'start', maxLines = 2 } = {}) {
  const lines = wrap(text, maxChars, maxLines);
  const w = Math.max(...lines.map(l => l.length)) * size * .53 + 26, h = lines.length * size * 1.2 + 16;
  const left = anchor === 'end' ? x - w : x;
  return `<g class="cap"><rect x="${n1(left)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>` +
    lines.map((l, i) => `<text x="${n1(left + 13)}" y="${n1(y + 8 + size * .95 + i * size * 1.2)}" font-family="Comic Neue" font-weight="700" font-style="italic" font-size="${size}" fill="${INK}">${esc(l)}</text>`).join('') + '</g>';
}

function sfx(jp, en, x, y, size, rot = -8, fill = INK, outline = '#fff') {
  const stroke = (f, s, w) => `<text x="0" y="0" font-family="Dela Gothic One" font-size="${size}" text-anchor="middle" fill="${f}" stroke="${s}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke">${esc(jp)}</text>`;
  return `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${rot})"><g class="sfx">` +
    stroke(fill, INK, size * .2) + stroke(fill, outline, size * .12) + stroke(fill, fill, 0) +
    `<text x="0" y="${n1(size * .62)}" font-family="Bangers" font-size="${n1(size * .28)}" letter-spacing="2" text-anchor="middle" fill="${INK}" stroke="#fff" stroke-width="5" paint-order="stroke">${esc(en)}</text></g></g>`;
}

function portrait(img, x, y, w, h, id, { rounded = 0 } = {}) {
  const clip = `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rounded}"/></clipPath>`;
  const body = img
    ? `<image href="${img}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#tone)"/>` +
      `<path d="M${x + w * .5},${y + h * .2}a${w * .17},${h * .19} 0 1 1 -.1,0ZM${x + w * .12},${y + h}c0,-${h * .38} ${w * .76},-${h * .38} ${w * .76},0Z" fill="${INK}"/>`;
  return `${clip}<g clip-path="url(#${id})">${body}</g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rounded}" fill="none" stroke="${INK}" stroke-width="3"/>`;
}

function sweat(x, y, s = 1) {
  return `<path d="M${x},${y}q${7 * s},${12 * s} 0,${20 * s}q${-7 * s},${-8 * s} 0,${-20 * s}Z" fill="#fff" stroke="${INK}" stroke-width="2.4"/>`;
}

function starburst(r, cx, cy, r0, r1, n) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r0 : r1 * (.75 + r() * .25);
    d += `${i ? 'L' : 'M'}${n1(cx + Math.cos(a) * rr)},${n1(cy + Math.sin(a) * rr)}`;
  }
  return `<path d="${d}Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="miter"/>`;
}

// ---------------------------------------------------------------- the page

export function drawPage(story, portraits = {}) {
  const r = rng(story.full);
  const P = PANELS;
  const out = [];
  const panel = (key, inner, i) => {
    const p = P[key], b = bbox(p);
    out.push(`<g class="pnl" style="--i:${i}"><clipPath id="c-${key}"><polygon points="${pts(p)}"/></clipPath>` +
      `<g clip-path="url(#c-${key})"><rect x="${b.x - 5}" y="${b.y - 5}" width="${b.w + 10}" height="${b.h + 10}" fill="#fff"/>${inner(b)}</g>` +
      `<polygon points="${pts(p)}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="miter"/></g>`);
  };
  const face = login => portraits[login] || null;

  // 1. title
  panel('title', b => {
    const t = story.title.toUpperCase();
    const size = Math.min(112, (b.w - 260) / Math.max(4, t.length * .5));
    return speedLines(r, { x: b.x, y: b.y + 20, w: b.w, h: b.h - 40 }, 70, '#d9d6cf') +
      `<rect x="${b.x}" y="${b.y + b.h * .62}" width="${b.w}" height="${b.h}" fill="url(#tone)" opacity=".55"/>` +
      `<text x="${b.x + 44}" y="${b.y + 62}" font-family="Bangers" font-size="30" letter-spacing="4" fill="${INK}">VOLUME ${story.volume}  ·  CHAPTER 1</text>` +
      `<text x="${b.x + 40}" y="${b.y + 72 + size * .8}" font-family="Bangers" font-size="${n1(size)}" letter-spacing="3" fill="${INK}" stroke="#fff" stroke-width="10" paint-order="stroke">${esc(t)}</text>` +
      `<text x="${b.x + 44}" y="${b.y + 104 + size * .8}" font-family="Bangers" font-size="26" letter-spacing="2" fill="#555">BY ${esc(story.owner.toUpperCase())}${story.language ? '  ·  ' + esc(story.language.toUpperCase()) : ''}</text>` +
      starburst(r, b.x + b.w - 110, b.y + 92, 52, 84, 13) +
      `<text x="${b.x + b.w - 110}" y="${b.y + 82}" font-family="Bangers" font-size="${story.stars >= 1e5 ? 34 : 40}" text-anchor="middle" fill="${INK}">★${compact(story.stars)}</text>` +
      `<text x="${b.x + b.w - 110}" y="${b.y + 114}" font-family="Bangers" font-size="20" text-anchor="middle" fill="${INK}">STARS</text>` +
      (story.tagline ? caption(b.x + b.w - 30, b.y + b.h - 64, story.tagline, { size: 17, maxChars: 52, maxLines: 2, anchor: 'end' }) : '');
  }, 0);

  // 2. the first commit
  panel('origin', b => {
    const o = story.origin, who = o.login || o.name;
    return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#tone2)" opacity=".35"/>` +
      focusLines(r, b.x + 150, b.y + 250, 120, 120, 90, '#1a1a1a') +
      portrait(face(o.login), b.x + 40, b.y + 150, 210, 210, 'pf-origin') +
      `<text x="${b.x + 145}" y="${b.y + b.h - 6}" font-family="Bangers" font-size="22" text-anchor="middle" fill="${INK}" stroke="#fff" stroke-width="5" paint-order="stroke">@${esc(who)}</text>` +
      bubble(b.x + 370, b.y + 170, 140, 92, [b.x + 240, b.y + 230], o.message || 'Initial commit', 21) +
      caption(b.x + 20, b.y + 40, `${monthYear(o.date)}. It begins.`, { size: 18 });
  }, 1);

  // 3. the crew
  panel('crew', b => {
    const crew = story.crew.slice(0, 4);
    const cols = crew.length > 1 ? 2 : 1, rows = Math.ceil(crew.length / cols);
    const cw = (b.w - 60) / cols, ch = (b.h - 90) / Math.max(rows, 1);
    let s = speedLines(r, b, 40, '#e4e1da') + caption(b.x + 18, b.y + 18, 'The crew', { size: 18 });
    crew.forEach((c, i) => {
      const x = b.x + 24 + (i % cols) * cw, y = b.y + 70 + Math.floor(i / cols) * ch, sz = Math.min(cw - 18, ch - 46);
      s += portrait(face(c.login), x, y, sz, sz, `pf-crew-${i}`) +
        `<text x="${n1(x + sz / 2)}" y="${n1(y + sz + 24)}" font-family="Bangers" font-size="21" text-anchor="middle" fill="${INK}">@${esc(c.login)}</text>` +
        `<text x="${n1(x + sz - 6)}" y="${n1(y + 26)}" font-family="Bangers" font-size="20" text-anchor="end" fill="#fff" stroke="${INK}" stroke-width="5" paint-order="stroke">${compact(c.commits)}</text>`;
    });
    return s;
  }, 2);

  // 4. the busiest day
  panel('rush', b => {
    const rush = story.rush;
    const cx = b.x + b.w * .5, cy = b.y + b.h * .48;
    let s = focusLines(r, cx, cy, 300, 95, 200) + `<ellipse cx="${cx}" cy="${cy}" rx="330" ry="104" fill="#fff"/>`;
    if (rush) {
      s += sfx('ドドドド', 'DO DO DO DO', cx - 30, cy + 22, 96, -6) +
        caption(b.x + 24, b.y + 22, `${dayMonth(rush.day)}.`, { size: 18 }) +
        caption(b.x + b.w - 24, b.y + b.h - 70, `${rush.count} commits in a single day.`, { size: 18, anchor: 'end' });
      rush.authors.slice(0, 4).forEach((a, i) => {
        const x = b.x + 30 + i * 74, y = b.y + b.h - 104;
        s += portrait(face(a.login), x, y, 64, 64, `pf-rush-${i}`, { rounded: 32 });
      });
    }
    return s;
  }, 3);

  // 5. drama
  panel('drama', b => {
    const d = story.drama;
    if (!d) return speedLines(r, b, 40);
    const gloomy = d.mood === 'despair' || d.mood === 'regret';
    const [jp, en] = SFX[d.mood] || SFX.sweat;
    let s = gloomy ? `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#tone2)" opacity=".7"/>` + gloomLines(r, { x: b.x, y: b.y, w: b.w, h: b.h }, 70)
      : speedLines(r, b, 50, '#e4e1da');
    s += portrait(face(d.login), b.x + 36, b.y + b.h - 196, 168, 168, 'pf-drama');
    if (!gloomy) s += sweat(b.x + 180, b.y + b.h - 200, 1.2) + sweat(b.x + 200, b.y + b.h - 170, .8);
    s += bubble(b.x + 300, b.y + 128, 150, 78, [b.x + 170, b.y + b.h - 190], d.message, 20) +
      sfx(jp, en, b.x + b.w - 96, b.y + b.h - 46, 50, -10) +
      `<text x="${b.x + 120}" y="${b.y + b.h - 8}" font-family="Bangers" font-size="20" text-anchor="middle" fill="${INK}" stroke="#fff" stroke-width="5" paint-order="stroke">@${esc(d.login || d.name)}</text>`;
    return s;
  }, 4);

  // 6. the release, or the numbers if there has never been one
  panel('release', b => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 10;
    let s = focusLines(r, cx, cy, 150, 90, 140) + `<ellipse cx="${cx}" cy="${cy}" rx="175" ry="104" fill="#fff"/>`;
    if (story.release) {
      const tag = story.release.tag;
      const size = Math.min(84, 360 / Math.max(3, tag.length * .52));
      s += `<text x="${cx}" y="${cy + size * .32}" font-family="Bangers" font-size="${n1(size)}" text-anchor="middle" letter-spacing="2" fill="${INK}" stroke="#fff" stroke-width="8" paint-order="stroke">${esc(tag)}</text>` +
        sfx('ドン', 'DON', b.x + b.w - 70, b.y + 90, 64, 10) +
        caption(b.x + 20, b.y + b.h - 64, `${dayMonth(story.release.date)}: it ships.`, { size: 17, maxChars: 30 });
    } else {
      s += `<text x="${cx}" y="${cy - 10}" font-family="Bangers" font-size="66" text-anchor="middle" fill="${INK}">★${compact(story.stars)}</text>` +
        `<text x="${cx}" y="${cy + 40}" font-family="Bangers" font-size="30" text-anchor="middle" fill="${INK}">${compact(story.forks)} FORKS</text>` +
        sfx('キラ', 'KIRA', b.x + b.w - 70, b.y + 90, 54, 10);
    }
    return s;
  }, 5);

  // 7. the latest commit, and the cliffhanger
  panel('latest', b => {
    const l = story.latest;
    return speedLines(r, b, 30, '#ebe8e1') +
      portrait(face(l.login), b.x + 24, b.y + 22, 116, 116, 'pf-latest') +
      thought(r, b.x + 370, b.y + 76, 190, 46, [b.x + 150, b.y + 110], l.message, 19) +
      `<text x="${b.x + b.w - 28}" y="${b.y + 98}" font-family="Bangers" font-size="44" text-anchor="end" fill="${INK}">TO BE CONTINUED…</text>` +
      `<text x="${b.x + b.w - 30}" y="${b.y + 130}" font-family="Comic Neue" font-weight="700" font-style="italic" font-size="17" text-anchor="end" fill="#555">${compact(story.totalCommits)} commit${story.totalCommits === 1 ? '' : 's'} so far. ${esc(dayMonth(l.date))}.</text>`;
  }, 6);

  const credit = `<text x="${PAGE.w - 30}" y="${PAGE.h - 9}" font-family="Comic Neue" font-weight="700" font-size="13" text-anchor="end" fill="#8a877f">${esc(story.full)} · drawn with Commit Manga · atharvalakhe.github.io/commit-manga</text>`;
  return { body: out.join('') + credit, defs:
    `<pattern id="tone" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="3" cy="3" r="1.4" fill="${INK}"/></pattern>` +
    `<pattern id="tone2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="2.5" cy="2.5" r="1.6" fill="${INK}"/></pattern>` };
}

export function toSVG(page, { fontCSS = '', animate = false } = {}) {
  const motion = animate ? `
    .pnl{animation:pin .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i) * .32s + .1s);transform-box:fill-box;transform-origin:center}
    .pnl .sfx{animation:pop .35s cubic-bezier(.2,1.6,.4,1) both;animation-delay:calc(var(--i) * .32s + .45s);transform-box:fill-box;transform-origin:center}
    @keyframes pin{from{opacity:0;transform:scale(1.04)}}
    @keyframes pop{from{opacity:0;transform:scale(.3)}}
    @media (prefers-reduced-motion:reduce){.pnl,.pnl .sfx{animation:none}}` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE.w} ${PAGE.h}" width="${PAGE.w}" height="${PAGE.h}">` +
    `<style>${fontCSS}${motion}</style><defs>${page.defs}</defs><rect width="${PAGE.w}" height="${PAGE.h}" fill="${PAPER}"/>${page.body}</svg>`;
}
