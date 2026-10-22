import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImportPanel, type ImportTarget } from './components/ImportPanel';
import { SettingsDialog } from './components/SettingsDialog';
import { SongTable } from './components/SongTable';
import type { ImportResult } from './importer';
import {
  addToCollection,
  applyYearHints,
  decadeOf,
  deleteCollection,
  deleteSongs,
  ensureCollection,
  isYearSuspect,
  loadLibrary,
  removeFromCollection,
  renameCollection,
  saveLibrary,
  setYear,
  songYear,
  upsertSongs,
} from './library';
import { getClientId, handleAuthCallback, isLoggedIn, login, logout, needsReconnect } from './spotify';
import type { Library, Song } from './types';

type Sort = 'added' | 'year' | 'title' | 'artist';
type SaveState = 'saved' | 'saving' | 'error';

const ALL = '__all__';
const UNSORTED = '__unsorted__';

export default function App() {
  const [lib, setLib] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [authError, setAuthError] = useState('');
  const [connected, setConnected] = useState(isLoggedIn);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showImport, setShowImport] = useState(true);

  const [view, setView] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [decade, setDecade] = useState<number | null>(null);
  const [suspectOnly, setSuspectOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('added');
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
  const handleSetYear = useCallback(
    (id: string, year: number | null) => update((l) => setYear(l, id, year)),
    [update],
  );

  const collections = useMemo(
    () => Object.values(lib?.collections ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [lib?.collections],
  );
  const allSongs = useMemo(() => Object.values(lib?.songs ?? {}), [lib?.songs]);

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
    const cmp: Record<Sort, (a: Song, b: Song) => number> = {
      added: (a, b) => b.addedAt - a.addedAt,
      year: (a, b) => (songYear(a) ?? 0) - (songYear(b) ?? 0),
      title: (a, b) => a.title.localeCompare(b.title),
      artist: (a, b) => a.artists[0].localeCompare(b.artists[0]),
    };
    return filtered.sort(cmp[sort]);
  }, [inView, query, decade, suspectOnly, sort]);

  const suspectCount = useMemo(() => inView.filter(isYearSuspect).length, [inView]);
  const activeCollection = lib?.collections[view];

  function handleImported(result: ImportResult, target: ImportTarget) {
    update((l) => {
      let next = upsertSongs(l, result.fetched);
      next = applyYearHints(next, result.yearHints);
      next = { ...next, searchCache: { ...next.searchCache, ...result.searchCache } };
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
    <div className="app">
      <header className="topbar">
        <h1>
          Song Guessr <span className="muted">Library</span>
        </h1>
        <span className={`save ${saveState}`}>
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

      <aside className="sidebar">
        <nav>
          <SidebarItem label="All songs" count={allSongs.length} active={view === ALL} onClick={() => setView(ALL)} />
          <SidebarItem
            label="Not in a collection"
            count={collectionCounts.unsorted}
            active={view === UNSORTED}
            onClick={() => setView(UNSORTED)}
          />
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
          <h2>{view === ALL ? 'All songs' : view === UNSORTED ? 'Not in a collection' : activeCollection?.name}</h2>
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

        <div className="toolbar">
          <input
            className="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, artist, album…"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="added">Recently added</option>
            <option value="year">Year</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
          </select>
          {suspectCount > 0 && (
            <label className="inline" title="Songs whose Spotify year may be a remaster/compilation year">
              <input type="checkbox" checked={suspectOnly} onChange={(e) => setSuspectOnly(e.target.checked)} />⚠ Check
              year ({suspectCount})
            </label>
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
          resetKey={`${view}|${query}|${decade}|${suspectOnly}|${sort}`}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onSetYear={handleSetYear}
        />
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
