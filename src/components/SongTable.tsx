import { memo, useEffect, useRef, useState } from 'react';
import { autoYear, isYearSuspect, songYear, yearSuggestion } from '../library';
import type { Collection, Song } from '../types';
import { locale, useT } from '../i18n';
import { PlayButton } from './PlayerBar';

export type SortKey = 'added' | 'year' | 'title' | 'artist' | 'album';
export interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

export interface YearActions {
  set: (id: string, year: number | null) => void;
  /** Accepts Spotify's year, clearing the ⚠ flag. */
  confirm: (id: string) => void;
}

interface Props {
  songs: Song[];
  collections: Record<string, Collection>;
  selected: Set<string>;
  /** Changes whenever the filters/sort change, so the table scrolls back to its first page. */
  resetKey: string;
  sort: Sort;
  onSort: (sort: Sort) => void;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  yearActions: YearActions;
}

const PAGE = 150;

export function SongTable({
  songs,
  collections,
  selected,
  resetKey,
  sort,
  onSort,
  onToggle,
  onToggleAll,
  yearActions,
}: Props) {
  const t = useT();
  const header = (key: SortKey, label: string) => (
    <SortHeader sortKey={key} label={label} sort={sort} onSort={onSort} />
  );
  // Render rows in pages as the user scrolls; mounting thousands of rows at once is what makes filtering slow.
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setLimit(PAGE), [resetKey]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    // Re-created after each page so it fires again if the sentinel is still in view.
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && setLimit((l) => l + PAGE), {
      rootMargin: '600px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit, songs.length]);

  if (!songs.length) return <p className="empty">{t.noSongs}</p>;
  const allSelected = songs.every((s) => selected.has(s.id));

  return (
    <>
      <table className="songs fixed">
        <colgroup>
          <col className="w-check" />
          <col className="w-cover" />
          <col />
          <col className="w-album" />
          <col className="w-year" />
          <col className="w-collections" />
          <col className="w-added" />
          <col className="w-actions" />
        </colgroup>
        <thead>
          <tr>
            <th className="check">
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} title={t.selectAllShown} />
            </th>
            <th />
            <th>
              {header('title', t.colTitle)} <span className="muted">/</span> {header('artist', t.colArtist)}
            </th>
            <th>{header('album', t.colAlbum)}</th>
            <th className="year">{header('year', t.colYear)}</th>
            <th>{t.colCollections}</th>
            <th className="added">{header('added', t.colAdded)}</th>
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
              yearActions={yearActions}
            />
          ))}
        </tbody>
      </table>
      {songs.length > limit && (
        <div ref={sentinel} className="muted count">
          {t.loadingMore}
        </div>
      )}
    </>
  );
}

// Text and year columns start A→Z / oldest first; "Added" starts newest first.
const DEFAULT_DIR: Record<SortKey, Sort['dir']> = {
  added: 'desc',
  year: 'asc',
  title: 'asc',
  artist: 'asc',
  album: 'asc',
};

/** A column title that sorts by it; clicking the active column flips the direction. */
function SortHeader(props: { sortKey: SortKey; label: string; sort: Sort; onSort: (sort: Sort) => void }) {
  const active = props.sort.key === props.sortKey;
  const next: Sort = active
    ? { key: props.sortKey, dir: props.sort.dir === 'asc' ? 'desc' : 'asc' }
    : { key: props.sortKey, dir: DEFAULT_DIR[props.sortKey] };
  return (
    <button className={`sort${active ? ' active' : ''}`} onClick={() => props.onSort(next)}>
      {props.label}
      {active && (props.sort.dir === 'asc' ? ' ▲' : ' ▼')}
    </button>
  );
}

const sameYear = (t: number) => new Date(t).getFullYear() === new Date().getFullYear();
const formatAdded = (t: number) =>
  new Date(t).toLocaleDateString(locale(), sameYear(t) ? { day: 'numeric', month: 'short' } : { dateStyle: 'medium' });

interface RowProps {
  song: Song;
  collections: Record<string, Collection>;
  isSelected: boolean;
  onToggle: (id: string) => void;
  yearActions: YearActions;
}

// Memoized so editing one song or toggling one checkbox only re-renders that row.
const SongRow = memo(function SongRow({ song: s, collections, isSelected, onToggle, yearActions }: RowProps) {
  const t = useT();
  return (
    <tr className={isSelected ? 'selected' : undefined}>
      <td className="check">
        <input type="checkbox" checked={isSelected} onChange={() => onToggle(s.id)} />
      </td>
      <td className="cover">{s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" />}</td>
      <td>
        <div className="title" title={s.title}>
          {s.title}
        </div>
        <div className="muted clip" title={s.artists.join(', ')}>
          {s.artists.join(', ')}
        </div>
      </td>
      <td className="muted album" title={s.album}>
        {s.album}
      </td>
      <td className="year">
        <YearCell song={s} actions={yearActions} />
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
      <td className="added muted" title={new Date(s.addedAt).toLocaleString(locale())}>
        {formatAdded(s.addedAt)}
      </td>
      <td className="actions">
        <PlayButton song={s} />
        <a
          className="open"
          href={`https://open.spotify.com/track/${s.id}`}
          target="_blank"
          rel="noreferrer"
          title={t.openInSpotify}
        >
          ↗
        </a>
      </td>
    </tr>
  );
});

function YearCell({ song, actions }: { song: Song; actions: YearActions }) {
  const t = useT();
  const year = songYear(song);
  const [draft, setDraft] = useState(year?.toString() ?? '');
  useEffect(() => setDraft(year?.toString() ?? ''), [year]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    // Leaving the field unchanged decides nothing (it would settle a pending suggestion).
    if (draft.trim() === (year?.toString() ?? '')) return;
    if (draft.trim() === '') actions.set(song.id, null);
    else if (parsed >= 1900 && parsed <= 2100) actions.set(song.id, parsed);
    else setDraft(year?.toString() ?? '');
  };

  const suspect = isYearSuspect(song);
  const overridden = song.yearOverride != null;
  const fromMusicBrainz = autoYear(song) != null;
  const title = overridden
    ? t.yearCorrectedTitle(String(song.spotifyYear ?? '?'))
    : fromMusicBrainz
      ? t.mbYearTitle(String(song.spotifyYear ?? '?'))
      : suspect
        ? t.yearSuspectTitle(song.album)
        : t.yearReleaseTitle(song.releaseDate);

  return (
    <span className={`year-cell${suspect ? ' suspect' : overridden ? ' overridden' : ''}`} title={title}>
      <input
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {suspect && <span className="flag">⚠</span>}
      {overridden && <span className="flag">✎</span>}
      {fromMusicBrainz && <span className="flag mb">MB</span>}
      {suspect && <YearSuggestion song={song} actions={actions} />}
    </span>
  );
}

/** For a ⚠ song: MusicBrainz's earlier year, if any, and ✓ to keep the year shown. */
function YearSuggestion({ song, actions }: { song: Song; actions: YearActions }) {
  const t = useT();
  const suggested = yearSuggestion(song);
  return (
    <>
      {suggested != null && (
        <button
          className="mini suggestion"
          title={t.mbSuggestionTitle(suggested)}
          onClick={() => actions.set(song.id, suggested)}
        >
          → {suggested}
        </button>
      )}
      <button
        className={`mini${suggested != null ? ' keep' : ''}`}
        title={suggested != null ? t.keepYearTitle : t.confirmYearTitle}
        onClick={() => actions.confirm(song.id)}
      >
        ✓
      </button>
    </>
  );
}
