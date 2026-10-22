import type { Collection, Library, Song, SongData } from './types';

export const emptyLibrary = (): Library => ({ version: 1, songs: {}, collections: {}, searchCache: {} });

export const newId = () => crypto.randomUUID().slice(0, 8);

// --- Persistence: data/library.json via the dev server (see vite.config.ts) ---

export async function loadLibrary(): Promise<Library> {
  const res = await fetch('/api/library');
  if (!res.ok) throw new Error(`Could not load library (${res.status})`);
  const json = await res.json();
  return json ? { ...emptyLibrary(), ...json } : emptyLibrary();
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
  if (s.yearOverride != null) return false;
  return s.albumType === 'compilation' || SUSPECT_ALBUM_RE.test(s.album) || /remaster/i.test(s.title);
}

export const decadeOf = (year: number | null | undefined) => (year == null ? null : Math.floor(year / 10) * 10);

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
  return { ...lib, songs: { ...lib.songs, [id]: { ...s, yearOverride } } };
}

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
