import { expect, test } from '@playwright/test';
import { fakeLogin, makeLibrary, makeTimelineGame, seed } from './fixtures';

const shot = (name: string) => ({ path: `e2e/.results/screens/${name}.png` });
const background = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('theme: the toggle cycles auto → light → dark and is remembered', async ({ page }) => {
  await seed(page, makeLibrary());
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /Theme/ });
  const dark = await background(page);
  await toggle.click(); // → light
  const light = await background(page);
  expect(light).not.toBe(dark);
  await page.screenshot(shot('library-light'));
  await page.reload();
  expect(await background(page)).toBe(light);
  await toggle.click(); // → dark
  expect(await background(page)).toBe(dark);
});

test('theme: auto follows the operating system', async ({ page }) => {
  await seed(page, makeLibrary());
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const light = await background(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await background(page)).not.toBe(light);
});

test('screens: library and a game in light and dark', async ({ page }) => {
  const lib = makeLibrary();
  for (const theme of ['light', 'dark']) {
    await seed(page, lib, { 'sg.theme': theme, 'sg.game': makeTimelineGame(lib, 8) });
    await page.goto('/');
    await expect(page.locator('.songs tbody tr').first()).toBeVisible();
    await page.screenshot(shot(`library-${theme}`));
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.locator('.slot').nth(2).click();
    await page.keyboard.press('Enter');
    await expect(page.locator('.verdict')).toBeVisible();
    await page.screenshot(shot(`game-${theme}`));
    await page.evaluate(() => sessionStorage.clear());
  }
});

test('language: switching to Danish translates the app and is remembered', async ({ page }) => {
  const lib = makeLibrary();
  await seed(page, lib, { 'sg.game': makeTimelineGame(lib, 4) });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Library' })).toBeVisible();
  await page.getByRole('button', { name: 'DA', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bibliotek' })).toBeVisible();
  await expect(page.getByText('Alle sange').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'da');
  await page.screenshot(shot('library-da'));
  await page.reload();
  await page.getByRole('button', { name: 'Spil', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vælg en plads på tidslinjen' })).toBeDisabled();
  await page.locator('.slot').first().click();
  await page.getByRole('button', { name: /Bekræft placering/ }).click();
  await expect(page.locator('.verdict')).toContainText(/Rigtigt|Forkert/);
  await page.screenshot(shot('game-da'));
});

test('language: a Danish browser starts in Danish', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'da-DK' });
  const page = await context.newPage();
  await seed(page, makeLibrary());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Bibliotek' })).toBeVisible();
  await context.close();
});

test('liked songs: pinned first with a heart, and can be updated from Spotify', async ({ page }) => {
  const lib = makeLibrary();
  // An older library: the collection has no source yet and is recognised by its name.
  lib.collections.liked = { id: 'liked', name: 'Liked Songs', createdAt: 0 };
  lib.collections.alpha = { id: 'alpha', name: 'Alpha', createdAt: 0, source: { kind: 'playlist', id: 'x' } };
  for (const id of ['song001', 'song002']) lib.songs[id].collectionIds.push('liked');
  await seed(page, lib, fakeLogin());
  await page.goto('/');
  const items = page.locator('.sidebar .nav-item');
  // All songs, Not in a collection, Duplicates, then collections: Liked Songs first.
  await expect(items.nth(3)).toContainText('♥Liked Songs');
  await expect(items.nth(4)).toContainText('♫Alpha');
  await items.nth(3).click();
  await expect(page.getByText('♥ Your Spotify Liked Songs')).toBeVisible();
  const update = page.getByRole('button', { name: '↻ Update from Spotify' });
  await expect(update).toBeEnabled();
  await update.click();
  // Spotify is blocked in tests, so the update reports an error instead of hanging.
  await expect(page.locator('.view-header .source .muted').last()).toContainText(/Liked Songs|failed|Couldn't/i);
  await page.screenshot(shot('liked-songs'));
});
