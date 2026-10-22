import { decadeOf, isYearSuspect, songYear } from './library';
import type { Library, Song } from './types';

export type Mode = 'timeline' | 'guess';

export interface GameSetup {
  mode: Mode;
  collectionIds: string[];
  /** Empty means every decade. */
  decades: number[];
  teams: string[];
  /** Timeline: cards (plus extra points) to win. Guess: points to win. */
  target: number;
  /** Start each song somewhere in the middle (harder). */
  randomStart: boolean;
  /** Timeline: an extra point each for the exact year, the artist and the title. */
  extraPoints?: boolean;
}

export interface Team {
  name: string;
  score: number;
  /** Timeline mode: song ids in timeline order. */
  timeline: string[];
}

export interface Round {
  songId: string;
  revealed: boolean;
  /** Timeline: where the team placed the card, and whether that was right. */
  placedAt?: number;
  correct?: boolean;
  /** Guess: which parts the team got right (each is a point). */
  awarded?: { title: boolean; artist: boolean; year: boolean };
}

export interface Game {
  setup: GameSetup;
  teams: Team[];
  /** Songs still to play, next first. */
  deck: string[];
  turn: number;
  round: Round | null;
  roundsPlayed: number;
  /** Index of the winning team, or -1 for a draw, once the game is over. */
  winner: number | null;
}

// --- Deck ---

/** Songs a game with these settings can draw from. Songs without a year can't be placed, so they're left out. */
export function eligibleSongs(lib: Library, setup: Pick<GameSetup, 'collectionIds' | 'decades'>): Song[] {
  const collections = new Set(setup.collectionIds);
  const decades = new Set(setup.decades);
  return Object.values(lib.songs).filter(
    (s) =>
      songYear(s) != null &&
      s.collectionIds.some((c) => collections.has(c)) &&
      (!decades.size || decades.has(decadeOf(songYear(s))!)),
  );
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffled, with songs played in recent games moved to the back (least recently played first). */
function buildDeck(songs: Song[], recent: string[]): string[] {
  const recentIndex = new Map(recent.map((id, i) => [id, i]));
  const fresh = shuffle(songs.filter((s) => !recentIndex.has(s.id)).map((s) => s.id));
  const replays = songs
    .filter((s) => recentIndex.has(s.id))
    .map((s) => s.id)
    .sort((a, b) => recentIndex.get(a)! - recentIndex.get(b)!);
  return [...fresh, ...replays];
}

// --- Game flow (each returns a new Game) ---

export function newGame(lib: Library, setup: GameSetup, recent: string[]): Game {
  const deck = buildDeck(eligibleSongs(lib, setup), recent);
  const teams: Team[] = setup.teams.map((name) => ({ name, score: 0, timeline: [] }));
  if (setup.mode === 'timeline') {
    // Hitster rules: every team starts with one face-up card.
    for (const team of teams) {
      const id = deck.shift();
      if (id) team.timeline = [id];
      team.score = team.timeline.length;
    }
  }
  return startRound({ setup, teams, deck, turn: 0, round: null, roundsPlayed: 0, winner: null });
}

function startRound(game: Game): Game {
  const [songId, ...deck] = game.deck;
  if (!songId) return finish(game);
  return { ...game, deck, round: { songId, revealed: false } };
}

function finish(game: Game): Game {
  const best = Math.max(...game.teams.map((t) => t.score));
  const leaders = game.teams.flatMap((t, i) => (t.score === best ? [i] : []));
  return { ...game, round: null, winner: leaders.length === 1 ? leaders[0] : -1 };
}

/** Moves to the next team's turn, or ends the game when someone reached the target or the deck is empty. */
export function nextTurn(game: Game): Game {
  const next = { ...game, roundsPlayed: game.roundsPlayed + 1, turn: (game.turn + 1) % game.teams.length };
  if (game.teams.some((t) => t.score >= game.setup.target)) return finish(next);
  return startRound(next);
}

export const endGame = (game: Game) => finish(game);

/** Guess mode: shows the card. */
export function reveal(game: Game): Game {
  if (!game.round || game.round.revealed) return game;
  return { ...game, round: { ...game.round, revealed: true, awarded: { title: false, artist: false, year: false } } };
}

/** Toggles a point for the current team (Guess mode, or Timeline extra points). */
export function toggleAward(game: Game, field: 'title' | 'artist' | 'year'): Game {
  const round = game.round;
  if (!round?.awarded) return game;
  const on = !round.awarded[field];
  const teams = game.teams.map((t, i) => (i === game.turn ? { ...t, score: t.score + (on ? 1 : -1) } : t));
  return { ...game, teams, round: { ...round, awarded: { ...round.awarded, [field]: on } } };
}

/**
 * Timeline mode: the current team places the song before timeline[index] (index = length means last).
 * A correct card joins the timeline. A ⚠ year may be a later remaster or compilation year, so for those
 * cards the spot just before the right one also counts.
 */
export function place(game: Game, lib: Library, index: number): Game {
  const round = game.round;
  if (!round || round.revealed) return game;
  const song = lib.songs[round.songId];
  const team = game.teams[game.turn];
  const yearAt = (i: number) => songYear(lib.songs[team.timeline[i]]) ?? null;
  const year = songYear(song)!;
  const fits = (i: number) => {
    const prev = i > 0 ? yearAt(i - 1) : null;
    const next = i < team.timeline.length ? yearAt(i) : null;
    return (prev == null || prev <= year) && (next == null || year <= next);
  };
  const correct = fits(index) || (isYearSuspect(song) && index < team.timeline.length && fits(index + 1));
  const teams = game.teams.map((t, i) => {
    if (i !== game.turn || !correct) return t;
    const timeline = [...t.timeline.slice(0, index), round.songId, ...t.timeline.slice(index)];
    return { ...t, timeline, score: t.score + 1 };
  });
  const awarded = game.setup.extraPoints ? { title: false, artist: false, year: false } : undefined;
  return { ...game, teams, round: { ...round, revealed: true, placedAt: index, correct, awarded } };
}

// --- Persistence (this browser only) ---

const GAME_KEY = 'sg.game';
const RECENT_KEY = 'sg.recentlyPlayed';
const SETUP_KEY = 'sg.lastSetup';
const MAX_RECENT = 500;

const readJson = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
};

/** The game in progress, dropping songs that were deleted from the library since. */
export function loadGame(lib: Library): Game | null {
  const game = readJson<Game | null>(GAME_KEY, null);
  if (!game) return null;
  const exists = (id: string) => !!lib.songs[id];
  const cleaned: Game = {
    ...game,
    deck: game.deck.filter(exists),
    teams: game.teams.map((t) => ({ ...t, timeline: t.timeline.filter(exists) })),
  };
  const lostRound = game.winner == null && (!game.round || !exists(game.round.songId));
  return lostRound ? startRound({ ...cleaned, round: null }) : cleaned;
}

export function saveGame(game: Game | null) {
  if (game) localStorage.setItem(GAME_KEY, JSON.stringify(game));
  else localStorage.removeItem(GAME_KEY);
}

export const loadRecent = () => readJson<string[]>(RECENT_KEY, []);

/** Forgets which songs were played, so every song counts as fresh again. */
export const forgetPlayed = () => localStorage.removeItem(RECENT_KEY);

/** Remembers a played song, so the next games play it last. */
export function markPlayed(songId: string) {
  const recent = loadRecent().filter((id) => id !== songId);
  recent.push(songId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(-MAX_RECENT)));
}

export const loadLastSetup = () => readJson<GameSetup | null>(SETUP_KEY, null);
export const saveLastSetup = (setup: GameSetup) => localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
