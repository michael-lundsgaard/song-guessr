import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import type { Game } from '../src/game';
import type { Library } from '../src/types';
import { fakeLogin, makeLibrary, makeTimelineGame, seed } from './fixtures';

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

test('timeline: a double click on Confirm does not skip the reveal', async ({ page }) => {
  const lib = makeLibrary();
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': makeTimelineGame(lib, 5) });
  await page.goto('/');
  await page.locator('.slot').nth(2).click();
  await page.getByRole('button', { name: /Confirm placement/ }).dblclick();
  await expect(page.locator('.verdict')).toBeVisible();
  // The second click and → land on Next while it is still guarded.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.verdict')).toBeVisible();
  const next = page.getByRole('button', { name: /Next song/ });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator('.verdict')).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: /Next song/ })).toBeEnabled();
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

/** Places the song in a spot that is always right (or, with `wrong`, the first spot, which the fixture makes wrong). */
async function placeCard(page: Page, lib: Library, game: Game, team: number, songId: string, wrong = false) {
  const year = lib.songs[songId].spotifyYear!;
  const years = game.teams[team].timeline.map((id) => lib.songs[id].spotifyYear!);
  if (wrong) expect(years[0]).toBeLessThan(year);
  await page
    .locator('.slot')
    .nth(wrong ? 0 : years.filter((y) => y <= year).length)
    .click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toContainText(wrong ? 'Wrong' : 'Correct');
  await expect(page.getByRole('button', { name: /Next song/ })).toBeEnabled();
  await page.keyboard.press('ArrowRight');
}

test('winner: the round is played out, then play again starts a new game', async ({ page }) => {
  const lib = makeLibrary();
  // Both teams one card short of winning (Team 2 has 3 cards): Team 2 still gets its turn.
  const game = makeTimelineGame(lib, 3, { target: 4 });
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': game });
  await page.goto('/');
  await placeCard(page, lib, game, 0, game.round!.songId);
  await expect(page.getByText("Team 2's turn")).toBeVisible();
  await expect(page.locator('.final-note')).toHaveText(
    'The Hitmakers reached the target. The round is played to the end.',
  );
  await page.screenshot(shot('final-round'));
  await placeCard(page, lib, game, 1, game.deck[0], true);
  await expect(page.getByRole('heading', { name: 'The Hitmakers wins!' })).toBeVisible();
  await page.screenshot(shot('winner'));
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.team-score')).toHaveCount(2);
  await expect(page.locator('.team-score').first()).toContainText('The Hitmakers');
  await expect(page.locator('.team-score b').first()).toHaveText('1');
});

test('winner: a team that cannot draw level gets no last turn', async ({ page }) => {
  const lib = makeLibrary();
  // Team 2 has 3 cards; at a target of 5 it can't catch up once The Hitmakers reach 5.
  const game = makeTimelineGame(lib, 4, { target: 5 });
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': game });
  await page.goto('/');
  await placeCard(page, lib, game, 0, game.round!.songId);
  await expect(page.getByRole('heading', { name: 'The Hitmakers wins!' })).toBeVisible();
});

test('a tie after the last round goes to sudden death', async ({ page }) => {
  const lib = makeLibrary();
  const game = makeTimelineGame(lib, 3, { target: 4, extraPoints: false });
  for (const team of game.teams) team.bonus = 0;
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': game });
  await page.goto('/');
  await placeCard(page, lib, game, 0, game.round!.songId);
  await placeCard(page, lib, game, 1, game.deck[0]);
  await expect(page.locator('.final-note')).toHaveText('Sudden death: one more song each until a team leads.');
  await expect(page.getByText("The Hitmakers' turn")).toBeVisible();
  await expect(page.locator('.team-score b')).toHaveText(['4', '4']);
  await page.screenshot(shot('sudden-death'));
});

test('going to the library during a game never names the game song', async ({ page }) => {
  const lib = makeLibrary();
  await seed(page, lib, { ...fakeLogin(), 'sg.page': 'play' });
  await startGame(page, /^Timeline/);
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  const bar = page.locator('.player-bar');
  await expect(bar).toContainText('Game song (hidden)');
  // No row shows a pause button (that would point at the playing song).
  await expect(page.locator('.songs .play', { hasText: '❚❚' })).toHaveCount(0);
});

test('timeline: the host can overrule a verdict, and change it back', async ({ page }) => {
  const lib = makeLibrary();
  const game = makeTimelineGame(lib, 5);
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': game });
  await page.goto('/');
  // The song (1966) belongs after every card (1960–1963), so the first spot is wrong.
  await page.locator('.slot').first().click();
  await page.keyboard.press('Enter');
  const verdict = page.locator('.verdict');
  const score = page.locator('.team-score b').first();
  await expect(verdict).toContainText('Wrong');
  await expect(score).toHaveText('5');
  await page.getByRole('button', { name: 'Count it as right' }).click();
  await expect(verdict).toContainText("Correct! The card stays. (host's call)");
  await expect(score).toHaveText('6');
  await expect(page.locator('.mini-card')).toHaveCount(6);
  await expect(page.locator('.award')).toHaveCount(3);
  await page.screenshot(shot('timeline-overruled'));
  await page.getByRole('button', { name: 'Count it as wrong' }).click();
  await expect(verdict).toContainText('Wrong');
  await expect(verdict).not.toContainText("host's call");
  await expect(score).toHaveText('5');
  await expect(page.locator('.mini-card.misplaced')).toHaveCount(1);
});

test('timeline: fixing the year saves it on the song and scores the round again', async ({ page }) => {
  const lib = makeLibrary();
  const game = makeTimelineGame(lib, 5);
  const songId = game.round!.songId;
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': game });
  await page.goto('/');
  await page.locator('.slot').first().click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toContainText('Wrong');
  await page.getByRole('button', { name: 'Fix year' }).click();
  const input = page.getByRole('textbox', { name: 'Fix year' });
  await expect(input).toHaveValue('1966');
  await input.fill('1955');
  await page.screenshot(shot('timeline-fix-year'));
  await input.press('Enter');
  await expect(page.locator('.verdict')).toContainText('Correct');
  await expect(page.locator('.team-score b').first()).toHaveText('6');
  await expect(page.locator('.card-year')).toHaveText('1955');
  // Saved to the library file (debounced).
  await expect
    .poll(() => JSON.parse(fs.readFileSync('e2e/.data/library.json', 'utf8')).songs[songId].yearOverride)
    .toBe(1955);
});

test('timer: counts down from when the song starts, then counts the time over', async ({ page }) => {
  const lib = makeLibrary();
  await page.clock.install();
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': makeTimelineGame(lib, 5, { timer: 30 }) });
  await page.goto('/');
  const count = page.getByRole('timer');
  // Waits for the song: full, dimmed.
  await expect(count).toHaveText('30');
  await expect(page.locator('.card-timer.idle')).toHaveCount(1);
  await page.clock.fastForward(5_000);
  await expect(count).toHaveText('30');
  await page.keyboard.press(' '); // play
  await page.clock.fastForward(8_000);
  await expect(count).toHaveText('22');
  await expect(page.locator('.card-timer.run')).toHaveCount(1);
  await page.screenshot({ ...shot('timer-running'), animations: 'disabled' });
  await page.clock.fastForward(14_000);
  await expect(count).toHaveText('8');
  await expect(page.locator('.card-timer.warn')).toHaveCount(1);
  await page.screenshot({ ...shot('timer-warning'), animations: 'disabled' });
  await page.clock.fastForward(20_000);
  await expect(count).toHaveText('−12');
  await expect(count).toHaveAttribute('aria-label', '12 seconds over time');
  await page.screenshot({ ...shot('timer-over'), animations: 'disabled' });
  // It never stops anything: the team can still answer.
  await page.locator('.slot').first().click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(count).toHaveCount(0);
});

test('timer: off by default, chosen in setup, shown in the rules', async ({ page }) => {
  await seed(page, makeLibrary(), { 'sg.page': 'play' });
  await page.goto('/');
  const timer = page.getByRole('group', { name: 'Timer' });
  await expect(timer.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  await timer.getByRole('button', { name: '45 s' }).click();
  await page.screenshot(shot('setup-timer'));
  await page.getByText('Party').click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.locator('dialog[open]')).toContainText('Timer: 45 seconds');
});
