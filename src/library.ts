import type { Collection, Library, Song, SongData } from './types';

export const emptyLibrary = (): Library => ({
  version: 1,
  songs: {},
  collections: {},
  ignoredDuplicates: [],
});

export const newId = () => crypto.randomUUID().slice(0, 8);

// --- Persistence: data/library.json via the dev server (see vite.config.ts) ---

export async function loadLibrary(): Promise<Library> {
  const res = await fetch('/api/library');
  if (!res.ok) throw new Error(`Could not load library (${res.status})`);
  const json = await res.json();
  if (!json) return emptyLibrary();
  // searchCache belonged to the removed free-text import.
  const { searchCache: _, ...stored } = json;
  return { ...emptyLibrary(), ...stored };
}

export async function saveLibrary(lib: Library): Promise<void> {
  const res = await fetch('/api/library', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lib),
  });
  if (!res.ok) throw new Error(`Could not save library (${res.status})`);
}

// --- Derived values ---

export const songYear = (s: Song) => s.yearOverride ?? s.spotifyYear;

const SUSPECT_ALBUM_RE = /remaster|greatest|best of|hits|collection|anniversary|deluxe|edition|live|anthology|essential/i;

/** Spotify's year is the album's release year, which is often a later remaster or compilation. */
export function isYearSuspect(s: Song) {
  if (s.yearOverride != null || s.yearConfirmed) return false;
  return s.albumType === 'compilation' || SUSPECT_ALBUM_RE.test(s.album) || /remaster/i.test(s.title);
}

export const decadeOf = (year: number | null | undefined) => (year == null ? null : Math.floor(year / 10) * 10);

// Parenthesised parts that mark a version of a song rather than its name: "(Remastered 2011)", "(feat. X)".
const VERSION_PART_RE = /remaster|live|version|mono|stereo|edit|mix|feat|ft\.|with |from |deluxe|anniversary|recorded|demo/i;

/** The song's name without version suffixes: "Heroes - 2017 Remaster" -> "Heroes". */
export function stripVersion(title: string) {
  return (
    title
      .replace(/\s+-\s+.*$/, '')
      .replace(/\s*[([][^)\]]*[)\]]/g, (part) => (VERSION_PART_RE.test(part) ? '' : part))
      .trim() || title
  );
}

/** Lowercase, accent- and punctuation-free form for comparing names. */
export function normalizeName(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim() || name.toLowerCase()
  );
}

/** Songs with the same key are versions of the same song (original, remaster, single edit…). */
export const songKey = (s: Pick<Song, 'title' | 'artists'>) =>
  `${normalizeName(stripVersion(s.title))}|${normalizeName(s.artists[0] ?? '')}`;

export const duplicateGroupKey = (group: Song[]) =>
  group
    .map((s) => s.id)
    .sort()
    .join(',');

/** Groups of two or more library songs that look like versions of the same song. */
export function findDuplicates(lib: Library): Song[][] {
  const byKey = new Map<string, Song[]>();
  for (const s of Object.values(lib.songs)) {
    const key = songKey(s);
    byKey.set(key, [...(byKey.get(key) ?? []), s]);
  }
  const ignored = new Set(lib.ignoredDuplicates);
  return [...byKey.values()]
    .filter((group) => group.length > 1 && !ignored.has(duplicateGroupKey(group)))
    .map((group) => group.sort(preferVersion))
    .sort((a, b) => a[0].title.localeCompare(b[0].title));
}

/** Sort order for versions of a song: unflagged years first, then earliest year, then first added. */
function preferVersion(a: Song, b: Song) {
  return (
    Number(isYearSuspect(a)) - Number(isYearSuspect(b)) ||
    (songYear(a) ?? 9999) - (songYear(b) ?? 9999) ||
    a.addedAt - b.addedAt
  );
}

// --- Pure update operations (each returns a new Library) ---

export function upsertSongs(lib: Library, incoming: SongData[]): Library {
  const songs = { ...lib.songs };
  for (const data of incoming) {
    const existing = songs[data.id];
    // Refresh Spotify metadata but keep everything the user curated.
    songs[data.id] = existing
      ? { ...existing, ...data }
      : { ...data, addedAt: Date.now(), collectionIds: [], yearOverride: null };
  }
  return { ...lib, songs };
}

/** Applies years typed in the import text, unless the user already corrected the year. */
export function applyYearHints(lib: Library, hints: Record<string, number>): Library {
  const songs = { ...lib.songs };
  for (const [id, year] of Object.entries(hints)) {
    const s = songs[id];
    if (s && s.yearOverride == null && s.spotifyYear !== year) songs[id] = { ...s, yearOverride: year };
  }
  return { ...lib, songs };
}

export function setYear(lib: Library, id: string, year: number | null): Library {
  const s = lib.songs[id];
  if (!s) return lib;
  const yearOverride = year == null || year === s.spotifyYear ? null : year;
  // Clearing the year resets the song to Spotify's year, flag included.
  const yearConfirmed = year == null ? false : s.yearConfirmed;
  return { ...lib, songs: { ...lib.songs, [id]: { ...s, yearOverride, yearConfirmed } } };
}

/** Marks Spotify's year as right, so the song is no longer flagged ⚠. */
export const confirmYear = (lib: Library, id: string) =>
  mapSongs(lib, [id], (s) => ({ ...s, yearConfirmed: true }));

/**
 * Keeps one version of a song and deletes the others. The kept song gets every collection of the group
 * and the group's earliest year.
 */
export function mergeSongs(lib: Library, keepId: string, ids: string[]): Library {
  const keep = lib.songs[keepId];
  if (!keep) return lib;
  const group = ids.map((id) => lib.songs[id]).filter(Boolean);
  const others = group.filter((s) => s.id !== keepId);
  const years = group.map(songYear).filter((y): y is number => y != null);
  const earliest = years.length ? Math.min(...years) : null;
  let next = deleteSongs(lib, others.map((s) => s.id));
  next = mapSongs(next, [keepId], (s) => ({
    ...s,
    collectionIds: [...new Set(group.flatMap((g) => g.collectionIds))],
    addedAt: Math.min(...group.map((g) => g.addedAt)),
  }));
  if (earliest != null && earliest < (songYear(keep) ?? Infinity)) next = setYear(next, keepId, earliest);
  return next;
}

export const ignoreDuplicates = (lib: Library, group: Song[]): Library => ({
  ...lib,
  ignoredDuplicates: [...lib.ignoredDuplicates, duplicateGroupKey(group)],
});

export function deleteSongs(lib: Library, ids: Iterable<string>): Library {
  const songs = { ...lib.songs };
  for (const id of ids) delete songs[id];
  return { ...lib, songs };
}

function mapSongs(lib: Library, ids: Iterable<string>, fn: (s: Song) => Song): Library {
  const songs = { ...lib.songs };
  for (const id of ids) if (songs[id]) songs[id] = fn(songs[id]);
  return { ...lib, songs };
}

export const addToCollection = (lib: Library, ids: Iterable<string>, collectionId: string) =>
  mapSongs(lib, ids, (s) =>
    s.collectionIds.includes(collectionId) ? s : { ...s, collectionIds: [...s.collectionIds, collectionId] },
  );

export const removeFromCollection = (lib: Library, ids: Iterable<string>, collectionId: string) =>
  mapSongs(lib, ids, (s) => ({ ...s, collectionIds: s.collectionIds.filter((c) => c !== collectionId) }));

/** Returns the collection with this name (case-insensitive), creating it if needed. */
export function ensureCollection(lib: Library, name: string): [Library, string] {
  const trimmed = name.trim();
  const existing = Object.values(lib.collections).find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return [lib, existing.id];
  const collection: Collection = { id: newId(), name: trimmed, createdAt: Date.now() };
  return [{ ...lib, collections: { ...lib.collections, [collection.id]: collection } }, collection.id];
}

export function renameCollection(lib: Library, id: string, name: string): Library {
  const c = lib.collections[id];
  if (!c || !name.trim()) return lib;
  return { ...lib, collections: { ...lib.collections, [id]: { ...c, name: name.trim() } } };
}

export function deleteCollection(lib: Library, id: string): Library {
  const collections = { ...lib.collections };
  delete collections[id];
  return removeFromCollection({ ...lib, collections }, Object.keys(lib.songs), id);
}
