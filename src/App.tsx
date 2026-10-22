import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ImportPanel, type ImportTarget } from './components/ImportPanel';
import { DuplicatesView } from './components/DuplicatesView';
import { PlayerBar } from './components/PlayerBar';
import { PlayPage } from './components/PlayPage';
import { SettingsDialog } from './components/SettingsDialog';
import { SongTable, type Sort, type SortKey, type YearActions } from './components/SongTable';
import { pool, type ImportResult } from './importer';
import {
  addToCollection,
  applyYearHints,
  confirmYear,
  decadeOf,
  deleteCollection,
  deleteSongs,
  ensureCollection,
  findDuplicates,
  ignoreDuplicates,
  isYearSuspect,
  loadLibrary,
  mergeSongs,
  removeFromCollection,
  renameCollection,
  saveLibrary,
  setYear,
  songYear,
  upsertSongs,
} from './library';
import { getClientId, handleAuthCallback, isLoggedIn, login, logout, needsReconnect } from './spotify';
import type { Library, Song } from './types';
import { earlierRelease, findOriginalRelease, type YearLookup } from './versions';

type SaveState = 'saved' | 'saving' | 'error';

const ALL = '__all__';
const UNSORTED = '__unsorted__';
const DUPLICATES = '__duplicates__';

type Page = 'library' | 'play';
const PAGE_KEY = 'sg.page';

export default function App() {
  const [lib, setLib] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [authError, setAuthError] = useState('');
  const [connected, setConnected] = useState(isLoggedIn);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showImport, setShowImport] = useState(true);
  const [page, setPageState] = useState<Page>(() => (localStorage.getItem(PAGE_KEY) === 'play' ? 'play' : 'library'));
  const setPage = (p: Page) => {
    localStorage.setItem(PAGE_KEY, p);
    setPageState(p);
  };

  const [view, setView] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [decade, setDecade] = useState<number | null>(null);
  const [suspectOnly, setSuspectOnly] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'added', dir: 'desc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    handleAuthCallback()
      .then(() => setConnected(isLoggedIn()))
      .catch((e) => setAuthError(e.message));
    loadLibrary()
      .then((l) => {
        setLib(l);
        setShowImport(Object.keys(l.songs).length === 0);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  // Persist to data/library.json, debounced. Skip the initial load.
  const loaded = useRef<Library | null>(null);
  useEffect(() => {
    if (!lib) return;
    if (!loaded.current) {
      loaded.current = lib;
      return;
    }
    setSaveState('saving');
    const timer = setTimeout(() => {
      saveLibrary(lib)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 400);
    return () => clearTimeout(timer);
  }, [lib]);

  const update = useCallback((fn: (l: Library) => Library) => setLib((l) => (l ? fn(l) : l)), []);

  // Original-year lookups live only for this session; accepting one stores the year on the song.
  const [yearLookups, setYearLookups] = useState<Record<string, YearLookup>>({});
  const [findingYears, setFindingYears] = useState(false);
  const libRef = useRef(lib);
  libRef.current = lib;
  const findYear = useCallback(async (id: string) => {
    const song = libRef.current?.songs[id];
    if (!song) return;
    const setLookup = (lookup: YearLookup) => setYearLookups((m) => ({ ...m, [id]: lookup }));
    setLookup({ state: 'loading' });
    try {
      setLookup({ state: 'done', release: await findOriginalRelease(song) });
    } catch (e) {
      setLookup({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);
  const yearActions = useMemo<YearActions>(
    () => ({
      set: (id, year) => update((l) => setYear(l, id, year)),
      find: (id) => void findYear(id),
      confirm: (id) => update((l) => confirmYear(l, id)),
    }),
    [update, findYear],
  );

  const collections = useMemo(
    () => Object.values(lib?.collections ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [lib?.collections],
  );
  const allSongs = useMemo(() => Object.values(lib?.songs ?? {}), [lib?.songs]);
  const titleFor = useCallback(
    (uri: string) => {
      const s = allSongs.find((song) => song.uri === uri);
      return s && `${s.artists.join(', ')} – ${s.title}`;
    },
    [allSongs],
  );

  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let unsorted = 0;
    for (const s of allSongs) {
      if (!s.collectionIds.length) unsorted++;
      for (const id of s.collectionIds) counts[id] = (counts[id] ?? 0) + 1;
    }
    return { counts, unsorted };
  }, [allSongs]);

  const inView = useMemo(
    () =>
      allSongs.filter((s) =>
        view === ALL ? true : view === UNSORTED ? s.collectionIds.length === 0 : s.collectionIds.includes(view),
      ),
    [allSongs, view],
  );

  const decadeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of inView) {
      const d = decadeOf(songYear(s));
      if (d != null) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [inView]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = inView.filter(
      (s) =>
        (!q || `${s.title} ${s.artists.join(' ')} ${s.album}`.toLowerCase().includes(q)) &&
        (decade == null || decadeOf(songYear(s)) === decade) &&
        (!suspectOnly || isYearSuspect(s)),
    );
    const cmp: Record<SortKey, (a: Song, b: Song) => number> = {
      added: (a, b) => a.addedAt - b.addedAt,
      year: (a, b) => (songYear(a) ?? 0) - (songYear(b) ?? 0),
      title: (a, b) => a.title.localeCompare(b.title),
      artist: (a, b) => a.artists[0].localeCompare(b.artists[0]),
      album: (a, b) => a.album.localeCompare(b.album),
    };
    const sign = sort.dir === 'asc' ? 1 : -1;
    // Songs without a year go last in both directions.
    const noYear = (s: Song) => (sort.key === 'year' && songYear(s) == null ? 1 : 0);
    return filtered.sort((a, b) => noYear(a) - noYear(b) || sign * cmp[sort.key](a, b));
  }, [inView, query, decade, suspectOnly, sort]);

  const suspects = useMemo(() => inView.filter(isYearSuspect), [inView]);
  const suspectCount = suspects.length;
  const foundYears = useMemo(
    () =>
      suspects.flatMap((s) => {
        const release = earlierRelease(s, yearLookups[s.id]);
        return release ? [{ id: s.id, year: release.year }] : [];
      }),
    [suspects, yearLookups],
  );
  const activeCollection = lib?.collections[view];

  const duplicates = useMemo(() => (lib ? findDuplicates(lib) : []), [lib?.songs, lib?.ignoredDuplicates]);

  async function findAllYears() {
    const ids = suspects.filter((s) => yearLookups[s.id]?.state !== 'done').map((s) => s.id);
    setFindingYears(true);
    await pool(ids, 3, findYear);
    setFindingYears(false);
  }

  function mergeGroup(keepId: string, group: Song[]) {
    const ids = group.map((s) => s.id);
    update((l) => mergeSongs(l, keepId, ids));
    setSelected((prev) => new Set([...prev].filter((id) => id === keepId || !ids.includes(id))));
  }

  function handleImported(result: ImportResult, target: ImportTarget) {
    update((l) => {
      let next = upsertSongs(l, result.fetched);
      next = applyYearHints(next, result.yearHints);
      let collectionId = target.collectionId;
      if (target.newCollectionName) [next, collectionId] = ensureCollection(next, target.newCollectionName);
      if (collectionId) next = addToCollection(next, result.songIds, collectionId);
      if (target.collectionPerPlaylist) {
        for (const group of result.groups) {
          let groupId: string;
          [next, groupId] = ensureCollection(next, group.name);
          next = addToCollection(next, group.songIds, groupId);
        }
      }
      return next;
    });
  }

  const toggle = useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );

  const toggleAll = () =>
    setSelected((prev) =>
      shown.every((s) => prev.has(s.id)) ? new Set() : new Set([...prev, ...shown.map((s) => s.id)]),
    );

  function newCollection() {
    const name = prompt('Collection name');
    if (!name?.trim()) return;
    let id = '';
    update((l) => {
      const [next, cid] = ensureCollection(l, name);
      id = cid;
      return selected.size ? addToCollection(next, selected, cid) : next;
    });
    // setLib updaters run synchronously during the next render; switch view after it.
    setTimeout(() => id && setView(id));
  }

  if (loadError) {
    return (
      <div className="fatal">
        <h1>Couldn't load the library</h1>
        <p>{loadError}</p>
        <p className="muted">The library is stored by the dev server — start the app with <code>npm run dev</code>.</p>
      </div>
    );
  }
  if (!lib) return <div className="fatal muted">Loading library…</div>;

  return (
    <div className={`app${page === 'play' ? ' play' : ''}`}>
      <header className="topbar">
        <h1>Song Guessr</h1>
        <nav className="page-tabs">
          {(['library', 'play'] as const).map((p) => (
            <button key={p} className={page === p ? 'active' : undefined} onClick={() => setPage(p)}>
              {p === 'library' ? 'Library' : 'Play'}
            </button>
          ))}
        </nav>
        <span
          className={`save ${saveState}`}
          title="Library changes are saved automatically to data/library.json in the project folder"
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed!' : 'Saved'}
        </span>
        <div className="spacer" />
        {authError && <span className="error-text">{authError}</span>}
        {connected ? (
          <>
            {needsReconnect() ? (
              <button
                className="primary"
                title="The app needs new Spotify permissions (e.g. Liked Songs)"
                onClick={() => login().catch((e) => setAuthError(e.message))}
              >
                Reconnect Spotify
              </button>
            ) : (
              <span className="connected">● Spotify connected</span>
            )}
            <button
              className="ghost"
              onClick={() => {
                logout();
                setConnected(false);
              }}
            >
              Disconnect
            </button>
          </>
        ) : getClientId() ? (
          <button className="primary" onClick={() => login().catch((e) => setAuthError(e.message))}>
            Connect Spotify
          </button>
        ) : (
          <button className="primary" onClick={() => setSettingsOpen(true)}>
            Set up Spotify
          </button>
        )}
        <button className="ghost icon" onClick={() => setSettingsOpen(true)} title="Spotify settings">
          ⚙
        </button>
      </header>

      {page === 'library' ? (
        <>
          <aside className="sidebar">
            <nav>
              <SidebarItem label="All songs" count={allSongs.length} active={view === ALL} onClick={() => setView(ALL)} />
              <SidebarItem
                label="Not in a collection"
                count={collectionCounts.unsorted}
                active={view === UNSORTED}
                onClick={() => setView(UNSORTED)}
              />
              {duplicates.length > 0 && (
                <SidebarItem
                  label="Duplicates"
                  count={duplicates.length}
                  active={view === DUPLICATES}
                  onClick={() => setView(DUPLICATES)}
                />
              )}
              <h3>Collections</h3>
              {collections.map((c) => (
                <SidebarItem
                  key={c.id}
                  label={c.name}
                  count={collectionCounts.counts[c.id] ?? 0}
                  active={view === c.id}
                  onClick={() => setView(c.id)}
                />
              ))}
              <button className="ghost new-collection" onClick={newCollection}>
                + New collection{selected.size ? ` from ${selected.size} selected` : ''}
              </button>
            </nav>
          </aside>

          <main className="main">
            <div className="view-header">
              <h2>
                {view === ALL
                  ? 'All songs'
                  : view === UNSORTED
                    ? 'Not in a collection'
                    : view === DUPLICATES
                      ? 'Duplicates'
                      : activeCollection?.name}
              </h2>
              {activeCollection && (
                <>
                  <button
                    className="ghost small"
                    onClick={() => {
                      const name = prompt('Rename collection', activeCollection.name);
                      if (name) update((l) => renameCollection(l, activeCollection.id, name));
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="ghost small danger"
                    onClick={() => {
                      if (!confirm(`Delete collection "${activeCollection.name}"? The songs stay in the library.`)) return;
                      update((l) => deleteCollection(l, activeCollection.id));
                      setView(ALL);
                    }}
                  >
                    Delete collection
                  </button>
                </>
              )}
              <div className="spacer" />
              <button className={showImport ? 'ghost' : 'primary'} onClick={() => setShowImport((v) => !v)}>
                {showImport ? 'Hide import' : '+ Add songs'}
              </button>
            </div>

            {showImport && (
              <ImportPanel
                lib={lib}
                connected={connected}
                defaultCollectionId={activeCollection?.id ?? null}
                onImported={handleImported}
              />
            )}

            {view === DUPLICATES ? (
              <DuplicatesView
                groups={duplicates}
                collections={lib.collections}
                onMerge={mergeGroup}
                onIgnore={(group) => update((l) => ignoreDuplicates(l, group))}
              />
            ) : (
              <>
                {activeCollection && (
                  <Readiness
                    songs={inView}
                    suspectCount={suspectCount}
                    decadeCounts={decadeCounts}
                    onShowSuspects={() => setSuspectOnly(true)}
                  />
                )}

                <div className="toolbar">
                  <input
                    className="search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search title, artist, album…"
                  />
                  {suspectCount > 0 && (
                    <label className="inline" title="Songs whose Spotify year may be a remaster/compilation year">
                      <input type="checkbox" checked={suspectOnly} onChange={(e) => setSuspectOnly(e.target.checked)} />⚠ Check
                      year ({suspectCount})
                    </label>
                  )}
                  {suspectCount > 0 && (
                    <button
                      className="ghost small"
                      disabled={!connected || findingYears}
                      title="Search Spotify for the earliest release of every ⚠ song in this view"
                      onClick={findAllYears}
                    >
                      {findingYears ? 'Finding original years…' : '🔍 Find original years'}
                    </button>
                  )}
                  {foundYears.length > 0 && (
                    <button
                      className="ghost small"
                      title="Use the earliest release year found for each ⚠ song"
                      onClick={() => update((l) => foundYears.reduce((acc, f) => setYear(acc, f.id, f.year), l))}
                    >
                      Use found years ({foundYears.length})
                    </button>
                  )}
                </div>

                {decadeCounts.length > 0 && (
                  <div className="decades" title="Songs per decade — handy for a balanced timeline">
                    {decadeCounts.map(([d, n]) => (
                      <button
                        key={d}
                        className={`decade${decade === d ? ' active' : ''}`}
                        onClick={() => setDecade(decade === d ? null : d)}
                      >
                        <span>{String(d).slice(2)}s</span>
                        <b>{n}</b>
                      </button>
                    ))}
                  </div>
                )}

                {selected.size > 0 && (
                  <div className="selection-bar">
                    <b>{selected.size} selected</b>
                    <select
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) update((l) => addToCollection(l, selected, id));
                      }}
                    >
                      <option value="">Add to collection…</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {activeCollection && (
                      <button
                        className="ghost"
                        onClick={() => {
                          update((l) => removeFromCollection(l, selected, activeCollection.id));
                          setSelected(new Set());
                        }}
                      >
                        Remove from "{activeCollection.name}"
                      </button>
                    )}
                    <button
                      className="ghost danger"
                      onClick={() => {
                        if (!confirm(`Delete ${selected.size} songs from the library?`)) return;
                        update((l) => deleteSongs(l, selected));
                        setSelected(new Set());
                      }}
                    >
                      Delete from library
                    </button>
                    <div className="spacer" />
                    <button className="ghost" onClick={() => setSelected(new Set())}>
                      Clear selection
                    </button>
                  </div>
                )}

                <p className="muted count">
                  Showing {shown.length} of {inView.length} songs
                </p>
                <SongTable
                  songs={shown}
                  collections={lib.collections}
                  selected={selected}
                  resetKey={`${view}|${query}|${decade}|${suspectOnly}|${sort.key}|${sort.dir}`}
                  sort={sort}
                  onSort={setSort}
                  yearLookups={yearLookups}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  yearActions={yearActions}
                />
              </>
            )}
            <PlayerBar connected={connected} titleFor={titleFor} />
          </main>
        </>
      ) : (
        <PlayPage lib={lib} connected={connected} />
      )}

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

// Below this a game runs out of songs quickly; above this share one decade crowds the timeline.
const MIN_SONGS = 50;
const MAX_DECADE_SHARE = 0.4;

/** Whether a collection is ready to play: enough songs, checked years and a spread of decades. */
function Readiness(props: {
  songs: Song[];
  suspectCount: number;
  decadeCounts: [number, number][];
  onShowSuspects: () => void;
}) {
  const { songs, suspectCount, decadeCounts } = props;
  const withYear = decadeCounts.reduce((sum, [, n]) => sum + n, 0);
  const [topDecade, topCount] = decadeCounts.reduce((top, d) => (d[1] > top[1] ? d : top), [0, 0]);
  const issues: ReactNode[] = [];
  if (songs.length < MIN_SONGS) issues.push(`only ${songs.length} songs (aim for ${MIN_SONGS}+)`);
  if (suspectCount > 0) {
    issues.push(
      <button key="suspect" className="link" onClick={props.onShowSuspects}>
        {suspectCount} years to check ⚠
      </button>,
    );
  }
  if (songs.length > withYear) issues.push(`${songs.length - withYear} songs without a year`);
  if (decadeCounts.length < 3) issues.push(`only ${decadeCounts.length} decade${decadeCounts.length === 1 ? '' : 's'}`);
  else if (topCount / withYear > MAX_DECADE_SHARE) {
    issues.push(`${Math.round((topCount / withYear) * 100)}% from the ${String(topDecade).slice(2)}s`);
  }
  const span = decadeCounts.length
    ? `${decadeCounts.length} decades, ${decadeCounts[0][0]}s–${decadeCounts[decadeCounts.length - 1][0]}s`
    : 'no years';

  return (
    <div className={`readiness ${issues.length ? 'not-ready' : 'ready'}`}>
      <b>{issues.length ? 'Not quite ready' : '✓ Ready to play'}</b>
      <span className="muted">
        {songs.length} songs · {span}
      </span>
      {issues.map((issue, i) => (
        <span key={i} className="issue">
          {issue}
        </span>
      ))}
    </div>
  );
}

function SidebarItem(props: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item${props.active ? ' active' : ''}`} onClick={props.onClick}>
      <span>{props.label}</span>
      <span className="muted">{props.count}</span>
    </button>
  );
}
