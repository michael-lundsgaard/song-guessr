import { expect, test } from '@playwright/test';
import { makeLibrary, makeTimelineGame, seed } from './fixtures';

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
