import { t } from './i18n';
import { normalizeName, stripVersion } from './library';
import type { Song } from './types';

// Original release years from MusicBrainz, through the dev server's proxy (server/musicbrainz.ts), which keeps
// MusicBrainz's rate limit. Only an earlier year than Spotify's is ever used (see library.ts), because a later
// one means the search missed the original recording.

export class MusicBrainzError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface MbCredit {
  name?: string;
  joinphrase?: string;
  artist?: { name: string };
}
interface MbRecording {
  title: string;
  disambiguation?: string;
  video?: boolean;
  'first-release-date'?: string;
  'artist-credit'?: MbCredit[];
  isrcs?: string[];
}
interface MbReleaseGroup {
  title: string;
  'first-release-date'?: string;
  'artist-credit'?: MbCredit[];
}

async function mbGet<T>(resource: 'recording' | 'release-group', params: Record<string, string>, signal?: AbortSignal) {
  const res = await fetch(`/api/musicbrainz/${resource}?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new MusicBrainzError(res.status, body?.error ?? t().musicBrainzFailed(res.status));
  }
  return (await res.json()) as T;
}

const yearOf = (date: string | undefined) => {
  const year = parseInt(date?.slice(0, 4) ?? '', 10);
  return year > 1900 ? year : null;
};
const earliest = (years: (number | null)[]) => {
  const known = years.filter((y): y is number => y != null);
  return known.length ? Math.min(...known) : null;
};
const quote = (s: string) => `"${s.replace(/["\\]/g, '\\$&')}"`;

/** True when one of the song's artists is credited (also inside a combined credit like "Olly Alexander (Years & Years)"). */
function credited(song: Song, credits: MbCredit[] | undefined) {
  const wanted = song.artists.map(normalizeName);
  const names = (credits ?? []).map((c) => normalizeName(c.name ?? c.artist?.name ?? ''));
  const joined = normalizeName(
    (credits ?? []).map((c) => (c.name ?? c.artist?.name ?? '') + (c.joinphrase ?? '')).join(''),
  );
  const within = (outer: string, inner: string) => inner.length >= 4 && ` ${outer} `.includes(` ${inner} `);
  return (
    names.some((n) => wanted.includes(n)) ||
    wanted.some((w) => w === joined || within(joined, w) || names.some((n) => within(w, n) || within(n, w)))
  );
}

// --- By ISRC: the exact recording, so remasters lead back to the original ---

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
export const ISRC_BATCH = 20;

/**
 * Looks up to ISRC_BATCH songs at once by ISRC. Returns the earliest first-release year per song id, for the songs
 * MusicBrainz knows (with a credited artist, as a guard against a wrongly attached ISRC).
 */
export async function yearsByIsrc(songs: Song[], signal?: AbortSignal): Promise<Map<string, number>> {
  const byIsrc = new Map<string, Song[]>();
  for (const s of songs) if (s.isrc && ISRC_RE.test(s.isrc)) byIsrc.set(s.isrc, [...(byIsrc.get(s.isrc) ?? []), s]);
  const years = new Map<string, number>();
  if (!byIsrc.size) return years;
  const query = `isrc:(${[...byIsrc.keys()].join(' OR ')})`;
  // An ISRC can sit on several recordings (a single and its album version), so there may be more than one page.
  for (let offset = 0; offset < 300; offset += 100) {
    const page = await mbGet<{ count: number; recordings?: MbRecording[] }>(
      'recording',
      { query, limit: '100', offset: String(offset) },
      signal,
    );
    for (const rec of page.recordings ?? []) {
      const year = yearOf(rec['first-release-date']);
      if (year == null) continue;
      for (const code of rec.isrcs ?? []) {
        for (const song of byIsrc.get(code) ?? []) {
          if (!credited(song, rec['artist-credit'])) continue;
          years.set(song.id, Math.min(year, years.get(song.id) ?? Infinity));
        }
      }
    }
    if (offset + 100 >= page.count) break;
  }
  return years;
}

// --- By title + artist: for songs without an ISRC, or whose ISRC MusicBrainz doesn't know ---

// A different recording of the song, whose year says nothing about the original.
const ALTERNATE_RE =
  /\b(live|remix|mix|edit|demo|acoustic|instrumental|karaoke|cover|re-?recorded|session|rehearsal|version)\b/i;

const sameTitle = (a: string, b: string) => normalizeName(stripVersion(a)) === normalizeName(b);

/**
 * Searches recordings by title and first artist and takes the earliest first-release year of the exact matches.
 * Big classics have hundreds of recordings and the search's top results can miss the original, so when that finds
 * nothing earlier than Spotify, the singles and albums of that name are searched too.
 */
export async function yearBySearch(song: Song, signal?: AbortSignal): Promise<number | null> {
  const title = stripVersion(song.title);
  const artist = song.artists[0] ?? '';
  const recordings = await mbGet<{ recordings?: MbRecording[] }>(
    'recording',
    { query: `recording:${quote(title)} AND artist:${quote(artist)}`, limit: '50' },
    signal,
  );
  const fromRecordings = earliest(
    (recordings.recordings ?? [])
      .filter((r) => !r.video && sameTitle(r.title, title) && credited(song, r['artist-credit']))
      .filter((r) => !ALTERNATE_RE.test(r.disambiguation ?? '') && !ALTERNATE_RE.test(r.title.slice(title.length)))
      .map((r) => yearOf(r['first-release-date'])),
  );
  if (fromRecordings != null && song.spotifyYear != null && fromRecordings < song.spotifyYear) return fromRecordings;

  const groups = await mbGet<{ 'release-groups'?: MbReleaseGroup[] }>(
    'release-group',
    {
      query: `releasegroup:${quote(title)} AND artist:${quote(artist)} AND NOT secondarytype:compilation AND NOT secondarytype:live`,
      limit: '50',
    },
    signal,
  );
  const fromGroups = earliest(
    (groups['release-groups'] ?? [])
      .filter((g) => sameTitle(g.title, title) && credited(song, g['artist-credit']))
      .map((g) => yearOf(g['first-release-date'])),
  );
  return earliest([fromRecordings, fromGroups]);
}
