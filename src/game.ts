import { decadeOf, isYearSuspect, songYear } from './library';
import type { Library, Song } from './types';

export type Mode = 'timeline' | 'guess' | 'closest' | 'decade' | 'artist';

export interface GameSetup {
  mode: Mode;
  collectionIds: string[];
  /** Empty means every decade. */
  decades: number[];
  teams: string[];
  /** Timeline: cards to win. Other modes: points to win. */
  target: number;
  /** Start each song somewhere in the middle (harder). */
  randomStart: boolean;
  /** Timeline: an extra point each for the exact year, the artist and the title, used as a tiebreaker. */
  extraPoints?: boolean;
  /** Seconds on the visual timer from when the song starts; 0 or missing means no timer. */
  timer?: number;
  /** Leave out songs whose year is still uncertain (flagged ⚠ in the library). */
  skipUncertain?: boolean;
}

export interface Team {
  name: string;
  score: number;
  /** Timeline extra points; they only break ties. */
  bonus?: number;
  /** Timeline mode: song ids in timeline order. */
  timeline: string[];
}

export interface Round {
  songId: string;
  revealed: boolean;
  /** Timeline: where the team placed the card, whether that was right, and where it belongs. */
  placedAt?: number;
  correct?: boolean;
  rightAt?: number;
  /** Guess: which parts the team got right (each is a point). */
  awarded?: { title: boolean; artist: boolean; year: boolean };
  /** Closest year: each team's guess (by team index), and the points each team got. */
  guesses?: (number | null)[];
  points?: number[];
  /** Which decade / Who's singing: the team's answer (decade start year, or artist name). */
  pick?: number | string;
  /** Who's singing: the artists to choose from. */
  options?: string[];
  /** The host flipped the verdict. */
  overruled?: boolean;
  /** The teams as they were before this round was scored, so a disputed round can be scored again. */
  before?: Team[];
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
  /** Which decade: the decades to choose from (every decade in the deck). */
  decadeChoices?: number[];
  /** Who's singing: the answer options for every song in the deck, made when the game starts. */
  artistOptions?: Record<string, string[]>;
  /** Sudden death: the tied teams (indexes, in turn order) that play one more song each until one leads. */
  suddenDeath?: number[];
}

/** Modes where the team whose turn it is answers alone (in Closest year everyone answers). */
export const isTurnBased = (mode: Mode) => mode !== 'closest';

// --- Deck ---

/**
 * Songs a game with these settings can draw from. Songs without a year can't be placed, so they're left out, and
 * so are songs with an uncertain year when the setup asks for it.
 */
export function eligibleSongs(
  lib: Library,
  setup: Pick<GameSetup, 'collectionIds' | 'decades' | 'skipUncertain'>,
): Song[] {
  const collections = new Set(setup.collectionIds);
  const decades = new Set(setup.decades);
  return Object.values(lib.songs).filter(
    (s) =>
      songYear(s) != null &&
      s.collectionIds.some((c) => collections.has(c)) &&
      (!decades.size || decades.has(decadeOf(songYear(s))!)) &&
      !(setup.skipUncertain && isYearSuspect(s)),
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

const mainArtist = (s: Song) => s.artists[0] ?? '';

const nameWords = (name: string) =>
  ` ${name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;

/** Same act or close enough to confuse: one name's words appear in the other's ("Axwell" / "Axwell /\ Ingrosso"). */
function namesClash(a: string, b: string): boolean {
  const wa = nameWords(a);
  const wb = nameWords(b);
  return wa.includes(wb) || wb.includes(wa);
}

/**
 * Four artists to choose from: the right one and three others from the deck, shuffled.
 * Only one option is credited on the song: the others never clash with any of its artists, or with each other.
 */
function artistOptionsFor(songs: Song[]): Record<string, string[]> {
  const artists = [...new Set(songs.map(mainArtist))];
  return Object.fromEntries(
    songs.map((s) => {
      const picked = [mainArtist(s)];
      const taken = [...s.artists];
      for (const a of shuffle(artists)) {
        if (picked.length === 4) break;
        if (taken.some((t) => namesClash(a, t))) continue;
        picked.push(a);
        taken.push(a);
      }
      return [s.id, shuffle(picked)];
    }),
  );
}

export function newGame(lib: Library, setup: GameSetup, recent: string[]): Game {
  const songs = eligibleSongs(lib, setup);
  const deck = buildDeck(songs, recent);
  const teams: Team[] = setup.teams.map((name) => ({ name, score: 0, timeline: [] }));
  if (setup.mode === 'timeline') {
    // Hitster rules: every team starts with one face-up card.
    for (const team of teams) {
      const id = deck.shift();
      if (id) team.timeline = [id];
      team.score = team.timeline.length;
    }
  }
  const game: Game = { setup, teams, deck, turn: 0, round: null, roundsPlayed: 0, winner: null };
  if (setup.mode === 'decade') {
    game.decadeChoices = [...new Set(songs.map((s) => decadeOf(songYear(s))!))].sort((a, b) => a - b);
  }
  if (setup.mode === 'artist') game.artistOptions = artistOptionsFor(songs);
  return startRound(game);
}

function startRound(game: Game): Game {
  const [songId, ...deck] = game.deck;
  if (!songId) return finish(game);
  const round: Round = { songId, revealed: false };
  if (game.setup.mode === 'closest') round.guesses = game.teams.map(() => null);
  if (game.setup.mode === 'artist') round.options = game.artistOptions?.[songId] ?? [];
  return { ...game, deck, round };
}

/** Ranks by score, then by extra points (the tiebreaker). */
export const compareTeams = (a: Team, b: Team) => b.score - a.score || (b.bonus ?? 0) - (a.bonus ?? 0);

/** Indexes of the teams ranked first (more than one on a tie), among `among` (default: every team). */
function leadersOf(teams: Team[], among = teams.map((_, i) => i)): number[] {
  const best = among.map((i) => teams[i]).sort(compareTeams)[0];
  return among.filter((i) => compareTeams(teams[i], best) === 0);
}

function finish(game: Game): Game {
  const leaders = leadersOf(game.teams);
  return { ...game, round: null, winner: leaders.length === 1 ? leaders[0] : -1 };
}

/** The most a team can score in one turn (Guess: title, artist and year). */
const maxTurnPoints = (mode: Mode) => (mode === 'guess' ? 3 : 1);

/** Whether a team reached the target, so the game is in its last round (or in sudden death). */
export const isFinalRound = (game: Game) => !!game.suddenDeath || game.teams.some((t) => t.score >= game.setup.target);

/**
 * Moves to the next team's turn, or ends the game.
 * Closest year ends as soon as a team reaches the target (everyone answers every song).
 * Turn-based modes play on to the end of the round when a team reaches the target, but only the teams that haven't
 * had their turn yet and could still draw level with the leader. A tie after that goes to extra points, then to
 * sudden death: the tied teams play one more song each until one leads.
 */
export function nextTurn(game: Game): Game {
  const played = { ...game, roundsPlayed: game.roundsPlayed + 1 };
  if (!isTurnBased(game.setup.mode)) {
    if (isFinalRound(game)) return finish(played);
    return startRound({ ...played, turn: (game.turn + 1) % game.teams.length });
  }
  // Rounds go in team order, so the teams after this one haven't had their turn in this round.
  const playing = game.suddenDeath ?? game.teams.map((_, i) => i);
  const waiting = playing.slice(playing.indexOf(game.turn) + 1);
  if (isFinalRound(game)) {
    // Only teams that could still draw level play; the others' turns can't change the result.
    const best = Math.max(...playing.map((i) => game.teams[i].score));
    const next = waiting.find((i) => game.teams[i].score + maxTurnPoints(game.setup.mode) >= best);
    if (next != null) return startRound({ ...played, turn: next });
    const leaders = leadersOf(game.teams, playing);
    if (leaders.length === 1) return finish(played);
    return startRound({ ...played, suddenDeath: leaders, turn: leaders[0] });
  }
  return startRound({ ...played, turn: waiting[0] ?? playing[0] });
}

export const endGame = (game: Game) => finish(game);

/** Guess mode: shows the card. */
export function reveal(game: Game): Game {
  if (!game.round || game.round.revealed) return game;
  return { ...game, round: { ...game.round, revealed: true, awarded: { title: false, artist: false, year: false } } };
}

/** Toggles a point for the current team: a score point in Guess mode, a tiebreaker point in Timeline. */
export function toggleAward(game: Game, field: 'title' | 'artist' | 'year'): Game {
  const round = game.round;
  if (!round?.awarded) return game;
  const on = !round.awarded[field];
  const key = game.setup.mode === 'timeline' ? 'bonus' : 'score';
  const teams = game.teams.map((t, i) => (i === game.turn ? { ...t, [key]: (t[key] ?? 0) + (on ? 1 : -1) } : t));
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
  // Where the card belongs: the picked spot if it fits, else the first spot that does.
  const rightAt = fits(index) ? index : [...Array(team.timeline.length + 1).keys()].find(fits)!;
  const correct = fits(index) || (isYearSuspect(song) && index < team.timeline.length && fits(index + 1));
  return settle(game, { ...round, placedAt: index, rightAt }, correct);
}

/**
 * Shows the card and scores the current team's answer on top of the scores before this round
 * (kept in round.before, so a disputed round can be scored again).
 * Timeline: a correct card joins the timeline where it belongs, so the timeline stays in order
 * (a card accepted one spot early, or overruled, included).
 */
function settle(game: Game, round: Round, correct: boolean): Game {
  const before = round.before ?? game.teams;
  const isTimeline = game.setup.mode === 'timeline';
  const teams = before.map((t, i) => {
    if (i !== game.turn || !correct) return t;
    if (!isTimeline) return { ...t, score: t.score + 1 };
    const at = round.rightAt!;
    return { ...t, timeline: [...t.timeline.slice(0, at), round.songId, ...t.timeline.slice(at)], score: t.score + 1 };
  });
  // Timeline extra points only for a card placed right.
  const awarded =
    isTimeline && game.setup.extraPoints && correct ? { title: false, artist: false, year: false } : undefined;
  return { ...game, teams, round: { ...round, revealed: true, correct, awarded, before } };
}

/** Rounds the host can overrule: those with a right / wrong verdict for the current team. */
export const canOverrule = (game: Game) =>
  !!game.round?.revealed && !!game.round.before && ['timeline', 'decade', 'artist'].includes(game.setup.mode);

/** The host flips the verdict of this round (and back again). Only the score changes, not the song's data. */
export function overrule(game: Game): Game {
  const round = game.round;
  if (!round || !canOverrule(game)) return game;
  const settled = settle(game, round, !round.correct);
  return { ...settled, round: { ...settled.round!, overruled: !round.overruled } };
}

/**
 * Scores the revealed round again with the same answer, after the host fixed the song's year (`lib` has the new
 * year). An overrule is dropped; extra points already given stay if the answer is still right.
 */
export function rescore(game: Game, lib: Library): Game {
  const round = game.round;
  if (!round?.revealed || !round.before) return game;
  const base: Game = { ...game, teams: round.before, round: { songId: round.songId, revealed: false } };
  let scored: Game;
  switch (game.setup.mode) {
    case 'timeline':
      scored = place(base, lib, round.placedAt!);
      break;
    case 'decade':
    case 'artist':
      scored = answer({ ...base, round: { ...base.round!, options: round.options } }, lib, round.pick!);
      break;
    case 'closest':
      scored = revealClosest({ ...base, round: { ...base.round!, guesses: round.guesses } }, lib);
      break;
    default:
      return game;
  }
  if (round.awarded && scored.round?.awarded) {
    scored = { ...scored, round: { ...scored.round, awarded: round.awarded } };
    const given = Object.values(round.awarded).filter(Boolean).length;
    scored.teams = scored.teams.map((t, i) => (i === game.turn ? { ...t, bonus: (t.bonus ?? 0) + given } : t));
  }
  return scored;
}

/** Closest year: records one team's guess (null clears it). */
export function setGuess(game: Game, team: number, year: number | null): Game {
  const round = game.round;
  if (!round?.guesses || round.revealed) return game;
  const guesses = round.guesses.map((g, i) => (i === team ? year : g));
  return { ...game, round: { ...round, guesses } };
}

/** Closest year: the team(s) closest to the year get a point, and an exact year one more. */
export function revealClosest(game: Game, lib: Library): Game {
  const round = game.round;
  if (!round?.guesses || round.revealed) return game;
  const year = songYear(lib.songs[round.songId])!;
  const distances = round.guesses.map((g) => (g == null ? Infinity : Math.abs(g - year)));
  const best = Math.min(...distances);
  const points = distances.map((d) => (d === Infinity || d !== best ? 0 : d === 0 ? 2 : 1));
  const teams = game.teams.map((t, i) => ({ ...t, score: t.score + points[i] }));
  return { ...game, teams, round: { ...round, revealed: true, points, before: game.teams } };
}

/**
 * Which decade / Who's singing: the current team's answer. A ⚠ year may be a later remaster or
 * compilation year, so the decade before also counts for those songs.
 */
export function answer(game: Game, lib: Library, pick: number | string): Game {
  const round = game.round;
  if (!round || round.revealed) return game;
  const song = lib.songs[round.songId];
  const decade = decadeOf(songYear(song));
  const correct =
    game.setup.mode === 'artist'
      ? pick === mainArtist(song)
      : pick === decade || (isYearSuspect(song) && pick === decade! - 10);
  return settle(game, { ...round, pick }, correct);
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
