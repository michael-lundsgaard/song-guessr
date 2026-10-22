import { expect, test } from '@playwright/test';
import { makeLibrary, makeTimelineGame, seed } from './fixtures';

const shot = (name: string) => ({ path: `e2e/.results/screens/${name}.png` });

// The page must never scroll sideways, whatever the window width or the titles.
for (const width of [1815, 1366, 1024]) {
  test(`no sideways scrolling at ${width} wide, during and after a round`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const lib = makeLibrary();
    lib.songs.song012.title = '革命道中 - On The Way (TV Anime "Kaguya-sama: Love Is War -Ultra Romantic-" Opening)';
    lib.songs.song012.artists = ['AiNA THE END'];
    await seed(page, lib, { 'sg.page': 'play', 'sg.game': makeTimelineGame(lib, 11) });
    await page.goto('/');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.locator('.slot').nth(1).click();
    await page.keyboard.press('Enter');
    await expect(page.locator('.verdict')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.screenshot(shot(`layout-${width}`));
  });
}

test('the main game button keeps its size and place through a round', async ({ page }) => {
  const lib = makeLibrary();
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': makeTimelineGame(lib, 5) });
  await page.goto('/');
  const main = page.locator('.player-bar > button.primary.big');
  const boxes = [await main.boundingBox()];
  await page.locator('.slot').nth(1).click(); // "Pick a spot" → "Confirm placement"
  boxes.push(await main.boundingBox());
  await page.keyboard.press('Enter'); // → "Next song"
  await expect(page.locator('.verdict')).toBeVisible();
  boxes.push(await main.boundingBox());
  for (const box of boxes) expect(box).toEqual(boxes[0]);
});

test('a wrong timeline answer shows where the card was put and where it belongs', async ({ page }) => {
  const lib = makeLibrary();
  const game = makeTimelineGame(lib, 6);
  await seed(page, lib, { 'sg.page': 'play', 'sg.game': game });
  await page.goto('/');
  // The first spot is wrong unless the song is at least as old as every card.
  const year = lib.songs[game.round!.songId].spotifyYear!;
  const years = game.teams[0].timeline.map((id) => lib.songs[id].spotifyYear!);
  test.skip(year <= Math.min(...years), 'fixture song happens to be oldest');
  await page.locator('.slot').first().click();
  await page.keyboard.press('Enter');
  await expect(page.locator('.verdict.wrong')).toBeVisible();
  await expect(page.locator('.mini-card.misplaced')).toHaveCount(1);
  await expect(page.locator('.belongs-here')).toHaveCount(1);
  await page.screenshot(shot('timeline-miss'));
});
