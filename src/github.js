// Everything Commit Manga needs from the GitHub REST API, in about six requests.
// Works without a token (60 requests an hour per visitor); a token lifts that to 5,000.

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export function parseRepo(input) {
  const text = String(input || '').trim()
    .replace(/[?#].*$/, '')
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '');
  const m = text.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)/);
  return m ? { owner: m[1], name: m[2] } : null;
}

async function get(path, token, { raw = false } = {}) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { headers });
  if (res.status === 404) throw new GitHubError('That repository does not exist, or it is private.', 404);
  if (res.status === 403 || res.status === 429) {
    const left = res.headers.get('x-ratelimit-remaining');
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    if (left === '0') {
      const mins = Math.max(1, Math.round((reset - Date.now()) / 60000));
      throw new GitHubError(`GitHub's limit for visitors without a token is used up. It resets in about ${mins} minute${mins === 1 ? '' : 's'}, or add a token below.`, 403);
    }
    if (raw) return res;  // e.g. contributors of a huge repo: handled by the caller
    throw new GitHubError('GitHub refused the request.', res.status);
  }
  if (!res.ok) throw new GitHubError(`GitHub answered ${res.status}.`, res.status);
  return raw ? res : res.json();
}

function lastPage(link) {
  const m = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(link || '');
  return m ? Number(m[1]) : 1;
}

const slim = c => ({
  sha: c.sha,
  message: (c.commit?.message || '').split('\n')[0].trim(),
  date: c.commit?.author?.date || c.commit?.committer?.date,
  login: c.author?.login || null,
  name: c.commit?.author?.name || 'someone',
  avatar: c.author?.avatar_url || null,
});

export async function fetchRepo({ owner, name }, token) {
  const base = `/repos/${owner}/${name}`;
  const repo = await get(base, token);
  const branch = encodeURIComponent(repo.default_branch);
  const [recent1, firstProbe, contribRes, releases] = await Promise.all([
    get(`${base}/commits?per_page=100&sha=${branch}`, token),
    get(`${base}/commits?per_page=1&sha=${branch}`, token, { raw: true }),
    get(`${base}/contributors?per_page=8`, token, { raw: true }),
    get(`${base}/releases?per_page=5`, token).catch(() => []),
  ]);
  const pages = lastPage(firstProbe.headers.get('link'));
  const [recent2, first] = await Promise.all([
    recent1.length === 100 ? get(`${base}/commits?per_page=100&page=2&sha=${branch}`, token).catch(() => []) : [],
    pages > 1 ? get(`${base}/commits?per_page=1&page=${pages}&sha=${branch}`, token) : firstProbe.json(),
  ]);
  const contributors = contribRes.ok ? (await contribRes.json()).filter(c => c.type !== 'Bot' && !/(\[bot\]|-bot)$/i.test(c.login)) : [];
  return {
    full: repo.full_name,
    url: repo.html_url,
    description: repo.description || '',
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    created: repo.created_at,
    totalCommits: pages,  // per_page=1, so the last page number is the commit count
    recent: [...recent1, ...recent2].map(slim),
    first: slim(first[0] || recent1[recent1.length - 1]),
    contributors: contributors.map(c => ({ login: c.login, avatar: c.avatar_url, commits: c.contributions })),
    releases: (releases || []).filter(r => !r.draft).map(r => ({ tag: r.tag_name, name: r.name || r.tag_name, date: r.published_at })),
  };
}
