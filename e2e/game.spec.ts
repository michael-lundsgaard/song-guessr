import { expect, test } from '@playwright/test';
import { makeLibrary, makeTimelineGame, seed } from './fixtures';

const shot = (name: string) => ({ path: `e2e/.results/screens/${name}.png`, fullPage: true });

test('setup: toggling options does not move the Start button', async ({ page }) => {
  await seed(page, makeLibrary(), { 'sg.page': 'play' });
  await page.goto('/');
  await page.getByText('Party').click();
  const start = page.getByRole('button', { name: 'Start game' });
  const before = await start.boundingBox();
  await page.getByRole('checkbox', { name: /Extra points/ }).click();
  await page.getByRole('checkbox', { name: /random start/ }).click();
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

async function startGame(page: import('@playwright/test').Page, mode: RegExp) {
  await page.goto('/');
  await page.getByRole('button', { name: mode }).click();
  await page.getByText('Party').click();
  await page.getByRole('button', { name: 'Start game' }).click();
}

test('closest year: every team guesses, the closest scores', async ({ page }) => {
  await seed(page, makeLibrary(), { 'sg.page': 'play' });
  await startGame(page, /Closest year/);
  await expect(page.getByText('Everyone guesses')).toBeVisible();
  const reveal = page.getByRole('button', { name: /Reveal/ });
  await expect(reveal).toBeDisabled();
  const inputs = page.locator('.guess-input');
  await expect(inputs).toHaveCount(2);
  await inputs.nth(0).fill('1960');
  await inputs.nth(0).press('Enter'); // moves to the next team
  await expect(inputs.nth(1)).toBeFocused();
  await inputs.nth(1).fill('2023');
  await page.screenshot(shot('closest-guessing'));
  await inputs.nth(1).press('Enter'); // reveals
  await expect(page.locator('.guess.scored')).not.toHaveCount(0);
  const scores = await page.locator('.team-score b').allTextContents();
  expect(scores.map(Number).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  await page.screenshot(shot('closest-revealed'));
});

test('which decade: pick, confirm, see the answer', async ({ page }) => {
  await seed(page, makeLibrary(), { 'sg.page': 'play' });
  await startGame(page, /Which decade/);
  const choices = page.locator('.choice-button');
  await expect(choices).toHaveCount(7); // 1960s–2020s in the fixture
  await choices.nth(2).click();
  await expect(page.locator('.choice-button.selected')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.choice-button.right')).toHaveCount(1);
  await page.screenshot(shot('decade-revealed'));
});

test("who's singing: four artists, one right", async ({ page }) => {
  await seed(page, makeLibrary(), { 'sg.page': 'play' });
  await startGame(page, /Who's singing/);
  const choices = page.locator('.choice-button');
  await expect(choices).toHaveCount(4);
  await choices.first().click();
  await page.getByRole('button', { name: /Confirm answer/ }).click();
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.choice-button.right')).toHaveCount(1);
  await page.screenshot(shot('artist-revealed'));
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.verdict')).toHaveCount(0);
  await expect(page.locator('.choice-button')).toHaveCount(4);
});

test('rules: shown for the chosen mode in setup, and in a dialog during the game', async ({ page }) => {
  await seed(page, makeLibrary(), { 'sg.page': 'play' });
  await page.goto('/');
  await page.getByRole('button', { name: /Closest year/ }).click();
  await expect(page.locator('.rules summary')).toHaveText('Rules: Closest year');
  await expect(page.locator('.rules-list li').first()).toContainText('Everyone plays every song');
  await page.getByRole('button', { name: /^Timeline/ }).click();
  await expect(page.locator('.rules summary')).toHaveText('Rules: Timeline');
  await page.getByText('Party').click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.locator('.slot').first().click();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toContainText('Every team starts with one card');
  await page.screenshot(shot('rules-dialog'));
  // Enter closes the dialog but must not confirm the picked slot behind it.
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.verdict')).toHaveCount(0);
  await expect(page.locator('.slot.selected')).toHaveCount(1);
});

test('winner: play again starts a new game with the same teams and fresh songs', async ({ page }) => {
  const lib = makeLibrary();
  // One card short of winning, so one right placement ends the game.
  const game = makeTimelineGame(lib, 3, { target: 4 });
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': game });
  await page.goto('/');
  // Place the card in a spot that is always right: find it by year.
  const year = lib.songs[game.round!.songId].spotifyYear!;
  const years = game.teams[0].timeline.map((id) => lib.songs[id].spotifyYear!);
  const index = years.filter((y) => y <= year).length;
  await page.locator('.slot').nth(index).click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toContainText('Correct');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'The Hitmakers wins!' })).toBeVisible();
  await page.screenshot(shot('winner'));
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.team-score')).toHaveCount(2);
  await expect(page.locator('.team-score').first()).toContainText('The Hitmakers');
  await expect(page.locator('.team-score b').first()).toHaveText('1');
});
