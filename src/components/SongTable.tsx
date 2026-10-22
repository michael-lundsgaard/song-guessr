import { memo, useEffect, useRef, useState } from 'react';
import { isYearSuspect, songYear } from '../library';
import type { Collection, Song } from '../types';
import { earlierRelease, type YearLookup } from '../versions';

export interface YearActions {
  set: (id: string, year: number | null) => void;
  /** Looks up the song's original release year on Spotify. */
  find: (id: string) => void;
  /** Accepts Spotify's year, clearing the ⚠ flag. */
  confirm: (id: string) => void;
}

interface Props {
  songs: Song[];
  collections: Record<string, Collection>;
  selected: Set<string>;
  yearLookups: Record<string, YearLookup>;
  /** Changes whenever the filters/sort change, so the table scrolls back to its first page. */
  resetKey: string;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  yearActions: YearActions;
}

const PAGE = 150;

export function SongTable({
  songs,
  collections,
  selected,
  yearLookups,
  resetKey,
  onToggle,
  onToggleAll,
  yearActions,
}: Props) {
  // Render rows in pages as the user scrolls; mounting thousands of rows at once is what makes filtering slow.
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setLimit(PAGE), [resetKey]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    // Re-created after each page so it fires again if the sentinel is still in view.
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setLimit((l) => l + PAGE),
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit, songs.length]);

  if (!songs.length) return <p className="empty">No songs here yet.</p>;
  const allSelected = songs.every((s) => selected.has(s.id));

  return (
    <>
      <table className="songs">
        <thead>
          <tr>
            <th className="check">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} title="Select all shown" />
            </th>
            <th />
            <th>Song</th>
            <th>Album</th>
            <th className="year">Year</th>
            <th>Collections</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {songs.slice(0, limit).map((s) => (
            <SongRow
              key={s.id}
              song={s}
              collections={collections}
              isSelected={selected.has(s.id)}
              yearLookup={yearLookups[s.id]}
              onToggle={onToggle}
              yearActions={yearActions}
            />
          ))}
        </tbody>
      </table>
      {songs.length > limit && <div ref={sentinel} className="muted count">Loading more…</div>}
    </>
  );
}

interface RowProps {
  song: Song;
  collections: Record<string, Collection>;
  isSelected: boolean;
  yearLookup?: YearLookup;
  onToggle: (id: string) => void;
  yearActions: YearActions;
}

// Memoized so editing one song or toggling one checkbox only re-renders that row.
const SongRow = memo(function SongRow({
  song: s,
  collections,
  isSelected,
  yearLookup,
  onToggle,
  yearActions,
}: RowProps) {
  return (
    <tr className={isSelected ? 'selected' : undefined}>
      <td className="check">
        <input type="checkbox" checked={isSelected} onChange={() => onToggle(s.id)} />
      </td>
      <td className="cover">{s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" />}</td>
      <td>
        <div className="title">{s.title}</div>
        <div className="muted">{s.artists.join(', ')}</div>
      </td>
      <td className="muted album">{s.album}</td>
      <td className="year">
        <YearCell song={s} lookup={yearLookup} actions={yearActions} />
      </td>
      <td>
        {s.collectionIds
          .map((id) => collections[id])
          .filter(Boolean)
          .map((c) => (
            <span key={c.id} className="chip">
              {c.name}
            </span>
          ))}
      </td>
      <td>
        <a
          className="open"
          href={`https://open.spotify.com/track/${s.id}`}
          target="_blank"
          rel="noreferrer"
          title="Open in Spotify"
        >
          ↗
        </a>
      </td>
    </tr>
  );
});

function YearCell({ song, lookup, actions }: { song: Song; lookup?: YearLookup; actions: YearActions }) {
  const year = songYear(song);
  const [draft, setDraft] = useState(year?.toString() ?? '');
  useEffect(() => setDraft(year?.toString() ?? ''), [year]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (draft.trim() === '') actions.set(song.id, null);
    else if (parsed >= 1900 && parsed <= 2100) actions.set(song.id, parsed);
    else setDraft(year?.toString() ?? '');
  };

  const suspect = isYearSuspect(song);
  const overridden = song.yearOverride != null;
  const title = overridden
    ? `Corrected by you (Spotify says ${song.spotifyYear ?? '?'}). Clear to reset.`
    : suspect
      ? `From "${song.album}" — this may be a remaster/compilation year. Check the original release year.`
      : `Release date on Spotify: ${song.releaseDate}`;

  return (
    <span className={`year-cell${suspect ? ' suspect' : ''}${overridden ? ' overridden' : ''}`} title={title}>
      <input
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {suspect && <span className="flag">⚠</span>}
      {overridden && <span className="flag">✎</span>}
      {suspect && <YearSuggestion song={song} lookup={lookup} actions={actions} />}
    </span>
  );
}

function YearSuggestion({ song, lookup, actions }: { song: Song; lookup?: YearLookup; actions: YearActions }) {
  const earlier = earlierRelease(song, lookup);
  return (
    <>
      {!lookup && (
        <button className="mini" title="Find the original release year on Spotify" onClick={() => actions.find(song.id)}>
          🔍
        </button>
      )}
      {lookup?.state === 'loading' && <span className="muted">…</span>}
      {lookup?.state === 'error' && (
        <button className="mini danger" title={`${lookup.message}. Click to retry.`} onClick={() => actions.find(song.id)}>
          !
        </button>
      )}
      {earlier && (
        <button
          className="mini suggestion"
          title={`Earliest release found: "${earlier.album}" (${earlier.year}). Click to use this year.`}
          onClick={() => actions.set(song.id, earlier.year)}
        >
          → {earlier.year}
        </button>
      )}
      {lookup?.state === 'done' && !earlier && (
        <span className="muted" title="Spotify has no earlier release of this song">
          none
        </span>
      )}
      <button className="mini" title="Spotify's year is right — stop flagging it" onClick={() => actions.confirm(song.id)}>
        ✓
      </button>
    </>
  );
}
