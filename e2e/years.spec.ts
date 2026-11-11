import { expect, test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { Library } from '../src/types';
import { makeLibrary, seed } from './fixtures';

const shot = (name: string) => ({ path: `e2e/.results/screens/${name}.png` });
const DATA_DIR = path.resolve('e2e/.data');
const readLibrary = (): Library => JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'library.json'), 'utf8'));
const backups = () => fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('library.backup-'));

/**
 * A fake MusicBrainz behind the dev server's proxy path: song001's ISRC is a 1950 recording, a search for song002
 * finds a 1975 recording, a search for song005 (a ⚠ "Greatest Hits" song) finds its Spotify year, everything else
 * is unknown. Returns the queries the app sent.
 */
async function fakeMusicBrainz(page: Page, lib: Library) {
  const queries: string[] = [];
  const s1 = lib.songs.song001;
  const s2 = lib.songs.song002;
  const s5 = lib.songs.song005;
  await page.route('**/api/musicbrainz/**', (route: Route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('query') ?? '';
    queries.push(`${url.pathname.split('/').pop()} ${query}`);
    const credit = (name: string) => [{ name, joinphrase: '' }];
    if (query.startsWith('isrc:'))
      return route.fulfill({
        json: {
          count: 1,
          recordings: [
            {
              title: s1.title,
              'first-release-date': '1950-05-01',
              isrcs: [s1.isrc],
              'artist-credit': credit(s1.artists[0]),
            },
          ],
        },
      });
    if (url.pathname.endsWith('/recording') && query.includes(s2.title))
      return route.fulfill({
        json: {
          recordings: [{ title: s2.title, 'first-release-date': '1975', 'artist-credit': credit(s2.artists[0]) }],
        },
      });
    if (url.pathname.endsWith('/recording') && query.includes(s5.title))
      return route.fulfill({
        json: {
          recordings: [
            { title: s5.title, 'first-release-date': String(s5.spotifyYear), 'artist-credit': credit(s5.artists[0]) },
          ],
        },
      });
    return route.fulfill({ json: { count: 0, recordings: [], 'release-groups': [] } });
  });
  return queries;
}

const yearCell = (page: Page, title: string) =>
  page.locator('.songs tbody tr').filter({ hasText: title }).locator('.year-cell');

test('year check: ISRC years are used, search years are suggested, and the library is backed up first', async ({
  page,
}) => {
  const lib = makeLibrary(6);
  lib.songs.song001.isrc = 'GBAAA0000001';
  lib.songs.song003.isrc = 'GBAAA0000003'; // not on MusicBrainz: falls back to the search
  for (const f of backups()) fs.unlinkSync(path.join(DATA_DIR, f));
  await seed(page, lib);
  const queries = await fakeMusicBrainz(page, lib);
  await page.goto('/');

  await page.getByRole('button', { name: 'Look up years on MusicBrainz (6)' }).click();
  // Done when every song has a stored result (the button is also hidden while the check runs).
  await expect
    .poll(() => Object.values(readLibrary().songs).filter((s) => s.yearCheck).length, { timeout: 10_000 })
    .toBe(6);
  await expect(page.getByRole('button', { name: /Look up years on MusicBrainz/ })).toHaveCount(0);
  expect(backups()).toHaveLength(1);

  // Both ISRCs went in one request; the five songs without an ISRC match were searched.
  expect(queries.filter((q) => q.startsWith('recording isrc:'))).toEqual([
    'recording isrc:(GBAAA0000001 OR GBAAA0000003)',
  ]);
  expect(queries.filter((q) => q.startsWith('recording recording:'))).toHaveLength(5);

  // ISRC: the year is used straight away, marked MB, and no longer flagged.
  const s1 = yearCell(page, lib.songs.song001.title);
  await expect(s1.locator('input')).toHaveValue('1950');
  await expect(s1.locator('.flag.mb')).toBeVisible();

  // A search that finds Spotify's own year clears the keyword ⚠.
  const s5 = yearCell(page, lib.songs.song005.title);
  await expect(s5.locator('input')).toHaveValue(String(lib.songs.song005.spotifyYear));
  await expect(s5).not.toHaveClass(/suspect/);

  // The summary says what happened; each count filters the table.
  const summary = page.locator('.year-summary');
  await expect(summary).toContainText('Looked up 6 songs:');
  for (const text of ['1 corrected', '1 to review', '1 unchanged', '3 not found'])
    await expect(summary.getByRole('button', { name: text })).toBeVisible();
  await summary.getByRole('button', { name: '1 corrected' }).click();
  await expect(page.locator('.songs tbody tr')).toHaveCount(1);
  await expect(page.locator('.songs tbody tr')).toContainText(lib.songs.song001.title);
  await summary.getByRole('button', { name: '1 to review' }).click();
  await expect(page.locator('.songs tbody tr')).toHaveCount(1);
  await page.screenshot(shot('year-check-review'));
  await summary.getByRole('button', { name: '1 to review' }).click();
  await expect(page.locator('.songs tbody tr')).toHaveCount(6);

  // Search: a one-click suggestion on a now-flagged song.
  const s2 = yearCell(page, lib.songs.song002.title);
  await expect(s2.locator('input')).toHaveValue(String(lib.songs.song002.spotifyYear));
  await expect(s2).toHaveClass(/suspect/);
  await page.screenshot(shot('year-check'));
  await s2.getByRole('button', { name: '→ 1975' }).click();
  await expect(s2.locator('input')).toHaveValue('1975');
  await expect(s2.getByRole('button', { name: '→ 1975' })).toHaveCount(0);
  // "To review" counts down to "all reviewed" as suggestions are handled.
  await expect(summary.getByRole('button', { name: 'all reviewed ✓' })).toBeDisabled();
  await page.screenshot(shot('year-check-reviewed'));

  // Everything is stored on the songs; Spotify's own year is untouched.
  await expect.poll(() => readLibrary().songs.song002.yearOverride, { timeout: 5000 }).toBe(1975);
  const saved = readLibrary().songs;
  expect(saved.song001.spotifyYear).toBe(lib.songs.song001.spotifyYear);
  expect(saved.song001.yearOverride ?? null).toBeNull();
  expect(saved.song001.yearCheck).toMatchObject({ year: 1950, via: 'isrc', isrc: 'GBAAA0000001' });
  expect(saved.song003.yearCheck).toMatchObject({ year: null, via: 'search', isrc: 'GBAAA0000003' });
  expect(saved.song002.yearCheck).toMatchObject({ year: 1975, via: 'search', settled: true });

  // The summary belongs to the view it ran in.
  await page.locator('.nav-item', { hasText: 'Party' }).click();
  await expect(summary).toHaveCount(0);
  for (const f of backups()) fs.unlinkSync(path.join(DATA_DIR, f));
});

test('year check: Stop leaves the rest unchecked, and an error is shown', async ({ page }) => {
  const lib = makeLibrary(6);
  await seed(page, lib);
  // MusicBrainz answers slowly, so there is time to press Stop.
  await page.route('**/api/musicbrainz/**', async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({ json: { count: 0, recordings: [], 'release-groups': [] } }).catch(() => {});
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Look up years on MusicBrainz (6)' }).click();
  await expect(page.getByText(/Looking up years… \d\/6/)).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: /Look up years on MusicBrainz \([1-6]\)/ })).toBeVisible();

  // An unreachable MusicBrainz stops the run with a message instead of marking songs checked.
  await page.unrouteAll();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route('**/api/musicbrainz/**', (route) =>
    route.fulfill({ status: 502, json: { error: 'MusicBrainz not reachable: fetch failed' } }),
  );
  const before = await page.getByRole('button', { name: /Look up years on MusicBrainz/ }).textContent();
  await page.getByRole('button', { name: /Look up years on MusicBrainz/ }).click();
  await expect(page.getByText('Year lookup stopped: MusicBrainz not reachable: fetch failed')).toBeVisible();
  await expect(page.getByRole('button', { name: /Look up years on MusicBrainz/ })).toHaveText(before!);
  for (const f of backups()) fs.unlinkSync(path.join(DATA_DIR, f));
});

test('year check: a busy MusicBrainz is waited out instead of stopping the run', async ({ page }) => {
  const lib = makeLibrary(2);
  await seed(page, lib);
  await page.clock.install();
  let busy = 2; // the first two answers are "busy", as when MusicBrainz is overloaded
  await page.route('**/api/musicbrainz/**', (route) =>
    busy-- > 0
      ? route.fulfill({ status: 503, json: { error: 'The MusicBrainz web server is currently busy.' } })
      : route.fulfill({ json: { count: 0, recordings: [], 'release-groups': [] } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Look up years on MusicBrainz (2)' }).click();
  await expect(page.getByText(/Looking up years… 0\/2/)).toBeVisible();
  await page.clock.fastForward(20_000);
  await page.clock.fastForward(40_000);
  await expect(page.locator('.year-summary')).toContainText('Looked up 2 songs:');
  await expect(page.getByText(/Year lookup stopped/)).toHaveCount(0);
  for (const f of backups()) fs.unlinkSync(path.join(DATA_DIR, f));
});
