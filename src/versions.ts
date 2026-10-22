import { normalizeName, songYear, stripVersion } from './library';
import { searchTracks } from './spotify';
import type { Song } from './types';

export interface OriginalRelease {
  year: number;
  album: string;
  trackId: string;
}

/** State of a "find original year" lookup for one song. */
export type YearLookup =
  | { state: 'loading' }
  | { state: 'done'; release: OriginalRelease | null }
  | { state: 'error'; message: string };

/** The release a finished lookup found, if it is earlier than the song's current year. */
export function earlierRelease(song: Song, lookup: YearLookup | undefined): OriginalRelease | null {
  const release = lookup?.state === 'done' ? lookup.release : null;
  const year = songYear(song);
  return release && (year == null || release.year < year) ? release : null;
}

// Versions that are a different recording, so their release year says nothing about the original.
const ALTERNATE_RE = /\b(live|remix|karaoke|instrumental|acoustic|demo|cover|tribute|re-?recorded|unplugged)\b/i;
const isAlternate = (s: Pick<Song, 'title' | 'album'>) => ALTERNATE_RE.test(s.title) || ALTERNATE_RE.test(s.album);

/**
 * Searches Spotify for other releases of the same song and returns the earliest non-compilation one.
 * Its year is usually the original release year, unlike the remaster or compilation year Spotify reports
 * for the version in the library.
 */
export async function findOriginalRelease(song: Song): Promise<OriginalRelease | null> {
  const title = stripVersion(song.title).replace(/"/g, '');
  const artist = (song.artists[0] ?? '').replace(/"/g, '');
  const candidates = await searchTracks(`track:"${title}" artist:"${artist}"`);
  const name = normalizeName(title);
  const artistName = normalizeName(artist);
  const songIsAlternate = isAlternate(song);
  let best: OriginalRelease | null = null;
  for (const c of candidates) {
    if (c.spotifyYear == null || c.albumType === 'compilation') continue;
    if (normalizeName(stripVersion(c.title)) !== name) continue;
    if (!c.artists.some((a) => normalizeName(a) === artistName)) continue;
    if (isAlternate(c) && !songIsAlternate) continue;
    if (!best || c.spotifyYear < best.year) best = { year: c.spotifyYear, album: c.album, trackId: c.id };
  }
  return best;
}
