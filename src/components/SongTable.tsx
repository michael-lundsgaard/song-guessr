import { memo, useEffect, useRef, useState } from 'react';
import { isYearSuspect, songYear } from '../library';
import type { Collection, Song } from '../types';

interface Props {
  songs: Song[];
  collections: Record<string, Collection>;
  selected: Set<string>;
  /** Changes whenever the filters/sort change, so the table scrolls back to its first page. */
  resetKey: string;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onSetYear: (id: string, year: number | null) => void;
}

const PAGE = 150;

export function SongTable({ songs, collections, selected, resetKey, onToggle, onToggleAll, onSetYear }: Props) {
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
              onToggle={onToggle}
              onSetYear={onSetYear}
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
  onToggle: (id: string) => void;
  onSetYear: (id: string, year: number | null) => void;
}

// Memoized so editing one song or toggling one checkbox only re-renders that row.
const SongRow = memo(function SongRow({ song: s, collections, isSelected, onToggle, onSetYear }: RowProps) {
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
        <YearCell song={s} onSetYear={onSetYear} />
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

function YearCell({ song, onSetYear }: { song: Song; onSetYear: (id: string, year: number | null) => void }) {
  const year = songYear(song);
  const [draft, setDraft] = useState(year?.toString() ?? '');
  useEffect(() => setDraft(year?.toString() ?? ''), [year]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (draft.trim() === '') onSetYear(song.id, null);
    else if (parsed >= 1900 && parsed <= 2100) onSetYear(song.id, parsed);
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
    </span>
  );
}
