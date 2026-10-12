import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStory, busiestDay, compact, dramaticCommit, volume, wrap } from '../src/story.js';
import { parseRepo as parseRepoSafe } from '../src/github.js';

const data = JSON.parse(readFileSync(new URL('./fixtures/repo.json', import.meta.url)));

test('reads owner/name from anything people paste', () => {
  assert.deepEqual(parseRepoSafe('facebook/react'), { owner: 'facebook', name: 'react' });
  assert.deepEqual(parseRepoSafe('https://github.com/vercel/next.js'), { owner: 'vercel', name: 'next.js' });
  assert.deepEqual(parseRepoSafe('github.com/a/b.git?tab=readme'), { owner: 'a', name: 'b' });
  assert.equal(parseRepoSafe('not a repo'), null);
});

test('finds the busiest day and its distinct authors', () => {
  const rush = busiestDay(data.recent);
  assert.equal(rush.day, '2026-09-29');
  assert.equal(rush.count, 4);
  assert.deepEqual(rush.authors.map(a => a.login), ['ana', 'bo']);
});

test('the most dramatic commit wins over a plain fix', () => {
  const d = dramaticCommit(data.recent);
  assert.equal(d.mood, 'regret');
  assert.match(d.message, /^Revert/);
});

test('a whole story comes out of a repository', () => {
  const s = buildStory(data, new Date('2026-10-13'));
  assert.equal(s.title, 'tide');
  assert.equal(s.volume, 3);
  assert.equal(s.origin.message, 'Initial commit');
  assert.equal(s.crew.length, 3);
  assert.equal(s.release.tag, 'v2.0.0');
  assert.equal(s.latest.message, 'Ship the docs site');
  assert.notEqual(s.drama.sha, s.latest.sha);
});

test('numbers and text fit their panels', () => {
  assert.equal(compact(950), '950');
  assert.equal(compact(1234), '1.2k');
  assert.equal(compact(228000), '228k');
  assert.equal(compact(1500000), '1.5M');
  assert.equal(volume('2025-10-14', new Date('2026-10-13')), 1);
  assert.deepEqual(wrap('one two three four five', 9), ['one two', 'three', 'four five']);
  assert.ok(wrap('a'.repeat(50), 10).every(l => l.length <= 10));
  assert.equal(wrap('w '.repeat(60), 10, 2).length, 2);
});
