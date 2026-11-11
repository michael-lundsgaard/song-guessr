import { useSyncExternalStore } from 'react';
import { pool } from './importer';
import { needsYearCheck, yearCheckOutcome, type YearCheckOutcome } from './library';
import { ISRC_BATCH, yearBySearch, yearsByIsrc } from './musicbrainz';
import type { Song, YearCheck } from './types';

// The MusicBrainz original-year check, running in the background while the app is open. Songs are queued by id;
// each batch first tries the songs' ISRCs in one request, then searches the rest by title and artist. Results go
// onto the songs through the app's normal library update, so the browser stays the library's only writer.
// Closing the tab or pressing Stop just pauses: unchecked songs are picked up by the next run.

export interface YearCheckStatus {
  running: boolean;
  done: number;
  total: number;
  error: string | null;
  /** Song ids per outcome since the run started (also kept after it ends, until dismissed or the next run). */
  outcomes: Record<YearCheckOutcome, string[]> | null;
}

/** How the check reads and stores songs; set by the app. */
export interface YearCheckTarget {
  getSong: (id: string) => Song | undefined;
  save: (id: string, check: YearCheck) => void;
}

const noOutcomes = (): Record<YearCheckOutcome, string[]> => ({
  corrected: [],
  review: [],
  unchanged: [],
  notFound: [],
});
let status: YearCheckStatus = { running: false, done: 0, total: 0, error: null, outcomes: null };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<YearCheckStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};

export const useYearCheck = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => status,
  );

let target: YearCheckTarget | null = null;
export const connectYearCheck = (t: YearCheckTarget) => void (target = t);

let queue: string[] = [];
let controller: AbortController | null = null;

/** Queues songs for the check (those that need it) and starts it if it isn't running. */
export function checkYears(ids: Iterable<string>) {
  const queued = new Set(queue);
  const fresh = [...new Set(ids)].filter((id) => {
    const song = target?.getSong(id);
    return !queued.has(id) && !!song && needsYearCheck(song);
  });
  if (!fresh.length) return;
  queue.push(...fresh);
  if (status.running) setStatus({ total: status.total + fresh.length });
  else {
    setStatus({ running: true, done: 0, total: fresh.length, error: null, outcomes: noOutcomes() });
    void run();
  }
}

/** Hides the summary of the last run. */
export const dismissYearCheck = () => setStatus({ outcomes: null, error: null });

export function stopYearCheck() {
  queue = [];
  controller?.abort();
}

async function run() {
  controller = new AbortController();
  const { signal } = controller;
  const save = (song: Song, year: number | null, via: YearCheck['via']) => {
    const check: YearCheck = { year, via, ...(song.isrc ? { isrc: song.isrc } : {}), checkedAt: Date.now() };
    target?.save(song.id, check);
    const outcome = yearCheckOutcome({ ...song, yearCheck: check });
    const outcomes = status.outcomes ?? noOutcomes();
    setStatus({ outcomes: { ...outcomes, [outcome]: [...outcomes[outcome], song.id] } });
  };
  try {
    while (queue.length && !signal.aborted) {
      const ids = queue.splice(0, ISRC_BATCH);
      const songs = ids.map((id) => target?.getSong(id)).filter((s): s is Song => !!s && needsYearCheck(s));
      const found = await yearsByIsrc(
        songs.filter((s) => s.isrc),
        signal,
      );
      for (const s of songs) if (found.has(s.id)) save(s, found.get(s.id)!, 'isrc');
      setStatus({ done: status.done + ids.length - songs.length + found.size });
      // Two at a time keeps the server's queue busy; it spaces the requests out anyway.
      await pool(
        songs.filter((s) => !found.has(s.id)),
        2,
        async (s) => {
          if (signal.aborted) return;
          save(s, await yearBySearch(s, signal), 'search');
          setStatus({ done: status.done + 1 });
        },
      );
    }
  } catch (e) {
    if (!signal.aborted) {
      setStatus({ error: e instanceof Error ? e.message : String(e) });
      controller.abort();
    }
    queue = [];
  } finally {
    controller = null;
    setStatus({ running: false });
  }
}
