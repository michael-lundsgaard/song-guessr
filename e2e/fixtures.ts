import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { Game, GameSetup } from '../src/game';
import type { Library, Song } from '../src/types';

// The test server reads its library from here (see playwright.config.ts); tests run from the project root.
const LIBRARY_FILE = path.resolve('e2e/.data/library.json');

const WORDS = ['Midnight', 'Summer', 'Electric', 'Heart', 'Dancing', 'River', 'Golden', 'Shadow', 'Fire', 'Love'];
const LONG_TITLE = 'A Really Long Song Title That Goes On (And On) - 2011 Remastered Deluxe Anniversary Edition';

// A cover that needs no network: a coloured square.
const cover = (i: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${(i * 47) % 360} 60% 45%)"/></svg>`,
  )}`;

/** `count` songs spread over 1960–2023, in one collection "Party". Every 7th has a long title, every 5th a ⚠ year. */
export function makeLibrary(count = 80): Library {
  const songs: Record<string, Song> = {};
  for (let i = 0; i < count; i++) {
    const id = `song${String(i).padStart(3, '0')}`;
    const suspect = i % 5 === 0;
    songs[id] = {
      id,
      uri: `spotify:track:${id}`,
      title: i % 7 === 0 ? LONG_TITLE : `${WORDS[i % WORDS.length]} ${WORDS[(i * 3) % WORDS.length]} ${i}`,
      artists: i % 7 === 0 ? ['The Extremely Long Band Name Orchestra', 'Featuring Somebody'] : [`Artist ${i % 13}`],
      album: suspect ? 'Greatest Hits' : `Album ${i}`,
      albumType: suspect ? 'compilation' : 'album',
      releaseDate: '',
      spotifyYear: 1960 + Math.floor((i * 64) / count),
      durationMs: 210_000,
      imageUrl: cover(i),
      addedAt: Date.now() - i * 60_000,
      collectionIds: ['party'],
    };
  }
  return {
    version: 1,
    songs,
    collections: { party: { id: 'party', name: 'Party', createdAt: 0 } },
    ignoredDuplicates: [],
  };
}

/** A Timeline game in progress where the current team already has `cards` cards. */
export function makeTimelineGame(lib: Library, cards: number, setup: Partial<GameSetup> = {}): Game {
  const ids = Object.keys(lib.songs);
  const byYear = (a: string, b: string) => lib.songs[a].spotifyYear! - lib.songs[b].spotifyYear!;
  const mine = ids.slice(0, cards).sort(byYear);
  const theirs = ids.slice(cards, cards + 3).sort(byYear);
  const [current, ...deck] = ids.slice(cards + 3);
  return {
    setup: {
      mode: 'timeline',
      collectionIds: ['party'],
      decades: [],
      teams: ['The Hitmakers', 'Team 2'],
      target: 40,
      randomStart: false,
      extraPoints: true,
      ...setup,
    },
    teams: [
      { name: 'The Hitmakers', score: mine.length, bonus: 4, timeline: mine },
      { name: 'Team 2', score: theirs.length, bonus: 1, timeline: theirs },
    ],
    deck,
    turn: 0,
    round: { songId: current, revealed: false },
    roundsPlayed: cards + 2,
    winner: null,
  };
}

/**
 * Prepares the browser: writes the library, blocks Spotify and other outside traffic,
 * and puts values in localStorage before the app starts.
 */
export async function seed(page: Page, lib: Library, storage: Record<string, unknown> = {}) {
  fs.mkdirSync(path.dirname(LIBRARY_FILE), { recursive: true });
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(lib));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.addInitScript((items) => {
    // Only on the first load, so a reload keeps what the app saved.
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, storage);
}

/** localStorage that makes the app think Spotify is connected (all Spotify traffic is still blocked). */
export const fakeLogin = () => ({
  'sg.spotifyToken': {
    accessToken: 'test',
    refreshToken: 'test',
    expiresAt: Date.now() + 3_600_000,
    scope:
      'playlist-read-private playlist-read-collaborative user-library-read user-read-playback-state user-modify-playback-state streaming user-read-email user-read-private',
  },
});
