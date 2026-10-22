import type { ImportItem } from './parse';
import { fetchAlbum, fetchLikedSongs, fetchPlaylist, fetchTrack, SpotifyError } from './spotify';
import type { Library, SongData } from './types';

export interface LogEntry {
  level: 'ok' | 'info' | 'warn' | 'error';
  text: string;
}

export interface ImportResult {
  /** Newly fetched song metadata. */
  fetched: SongData[];
  /** Every song the import resolved to, including ones already in the library. */
  songIds: string[];
  /** One group per playlist/album, used to create a collection per playlist. */
  groups: { name: string; songIds: string[] }[];
  yearHints: Record<string, number>;
  log: LogEntry[];
  failed: number;
}

/** Runs fn over items with at most `concurrency` calls in flight. */
export async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

const COPY_TIP =
  'Tip: open it in Spotify, click a song, press Ctrl+A then Ctrl+C, and paste the copied links here instead.';

function describe(e: unknown, kind: string) {
  if (e instanceof SpotifyError && e.status === 403 && /not be registered/i.test(e.message)) {
    return (
      `${e.message} — add your Spotify account's email under User Management in the Spotify developer ` +
      'dashboard, then disconnect and connect again here.'
    );
  }
  if (e instanceof SpotifyError && (e.status === 401 || e.status === 403) && kind === 'liked') {
    return `${e.message} — click Disconnect, then Connect Spotify again to grant access to Liked Songs.`;
  }
  if (e instanceof SpotifyError && (e.status === 404 || e.status === 403) && kind === 'playlist') {
    return (
      `not accessible (${e.message}). Spotify only lets apps read playlists you own or collaborate on. ` +
      COPY_TIP
    );
  }
  return e instanceof Error ? e.message : String(e);
}

/** Resolves import items to songs. Tracks already in the library are not fetched again. */
export async function runImport(
  items: ImportItem[],
  lib: Library,
  onProgress: (message: string) => void,
): Promise<ImportResult> {
  const fetched = new Map<string, SongData>();
  const songIds = new Set<string>();
  const result: ImportResult = { fetched: [], songIds: [], groups: [], yearHints: {}, log: [], failed: 0 };
  const log = (level: LogEntry['level'], text: string) => result.log.push({ level, text });
  const record = (d: SongData, yearHint?: number) => {
    fetched.set(d.id, d);
    songIds.add(d.id);
    if (yearHint) result.yearHints[d.id] = yearHint;
  };

  for (const item of items) {
    if (item.kind !== 'playlist' && item.kind !== 'album' && item.kind !== 'liked') continue;
    try {
      onProgress(`Loading ${item.kind === 'liked' ? 'Liked Songs' : item.kind}…`);
      const list =
        item.kind === 'playlist'
          ? await fetchPlaylist(item.id, (n) => onProgress(`Loading playlist… ${n} tracks`))
          : item.kind === 'liked'
            ? await fetchLikedSongs((n) => onProgress(`Loading Liked Songs… ${n} tracks`))
            : await fetchAlbum(item.id);
      list.tracks.forEach((d) => record(d));
      result.groups.push({ name: list.name, songIds: list.tracks.map((t) => t.id) });
      const kindLabel = { playlist: 'Playlist', album: 'Album', liked: 'Collection' }[item.kind];
      log('ok', `${kindLabel} "${list.name}": ${list.tracks.length} songs`);
      if (list.skipped) log('warn', `"${list.name}": skipped ${list.skipped} podcast episodes, local files or unavailable items`);
    } catch (e) {
      result.failed++;
      const what = item.kind === 'liked' ? 'Liked Songs' : `${item.kind} ${item.id}`;
      log('error', `Couldn't load ${what}: ${describe(e, item.kind)}`);
    }
  }

  const tracks = items.filter((i): i is Exclude<ImportItem, { kind: 'liked' }> => i.kind === 'track');
  let done = 0;
  let reused = 0;
  await pool(tracks, 4, async (item) => {
    try {
      if (lib.songs[item.id]) {
        songIds.add(item.id);
        if (item.yearHint) result.yearHints[item.id] = item.yearHint;
        reused++;
      } else {
        const d = await fetchTrack(item.id);
        if (d) record(d, item.yearHint);
        else {
          result.failed++;
          log('warn', `Track ${item.id} is not playable on Spotify`);
        }
      }
    } catch (e) {
      result.failed++;
      log('error', `Track ${item.id}: ${describe(e, item.kind)}`);
    }
    onProgress(`Looking up songs… ${++done}/${tracks.length}`);
  });
  if (reused) log('ok', `${reused} songs were already in the library (not fetched again)`);

  result.fetched = [...fetched.values()];
  result.songIds = [...songIds];
  return result;
}
