import { expect, test } from '@playwright/test';
import { makeLibrary, makeTimelineGame, seed } from './fixtures';

const shot = (name: string) => ({ path: `e2e/.results/screens/${name}.png`, fullPage: true });

test('setup: toggling options does not move the Start button', async ({ page }) => {
  await seed(page, makeLibrary(), { 'sg.page': 'play' });
  await page.goto('/');
  await page.getByText('Party').click();
  const start = page.getByRole('button', { name: 'Start game' });
  const before = await start.boundingBox();
  await page.getByText(/Extra points/).click();
  await page.getByText(/random start/).click();
  expect(await start.boundingBox()).toEqual(before);
  await page.screenshot(shot('setup'));
});

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
]) {
  test(`timeline: 30 cards at ${viewport.width}x${viewport.height} all visible, one card size`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const lib = makeLibrary();
    await seed(page, lib, { 'sg.page': 'play', 'sg.game': makeTimelineGame(lib, 30) });
    await page.goto('/');
    const cards = page.locator('.mini-card');
    await expect(cards).toHaveCount(30);
    const boxes = await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
    const sizes = new Set(boxes.map((b) => `${Math.round(b.width)}x${Math.round(b.height)}`));
    expect([...sizes]).toHaveLength(1);
    // No sideways scrolling: every card is inside the window horizontally.
    for (const b of boxes) expect(b.right).toBeLessThanOrEqual(viewport.width);
    await page.screenshot(shot(`timeline-30-${viewport.width}`));
  });
}

test('timeline: the big card keeps its size from hidden to revealed', async ({ page }) => {
  const lib = makeLibrary();
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': makeTimelineGame(lib, 5) });
  await page.goto('/');
  const hidden = await page.locator('.card').boundingBox();
  await page.locator('.slot').first().click();
  await page.getByRole('button', { name: /Confirm placement/ }).click();
  await expect(page.locator('.verdict')).toBeVisible();
  const revealed = await page.locator('.card').boundingBox();
  expect(revealed?.width).toBe(hidden?.width);
  expect(revealed?.height).toBe(hidden?.height);
  await page.screenshot(shot('timeline-revealed'));
});

test('timeline: a picked slot can be changed before confirming', async ({ page }) => {
  const lib = makeLibrary();
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': makeTimelineGame(lib, 5) });
  await page.goto('/');
  const confirm = page.getByRole('button', { name: /Pick a spot|Confirm placement/ });
  await expect(confirm).toBeDisabled();
  await page.locator('.slot').nth(0).click();
  await page.locator('.slot').nth(3).click();
  await expect(page.locator('.slot.selected')).toHaveCount(1);
  await expect(page.locator('.verdict')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toBeVisible();
});

test('a game in progress survives a reload', async ({ page }) => {
  const lib = makeLibrary();
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': makeTimelineGame(lib, 5) });
  await page.goto('/');
  await page.locator('.slot').first().click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toBeVisible();
  await page.reload();
  await expect(page.locator('.verdict')).toBeVisible();
});
