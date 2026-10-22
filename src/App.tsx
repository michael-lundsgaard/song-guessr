import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ImportPanel, type ImportTarget } from './components/ImportPanel';
import { DuplicatesView } from './components/DuplicatesView';
import { PlayerBar } from './components/PlayerBar';
import { PlayPage } from './components/PlayPage';
import { SettingsDialog } from './components/SettingsDialog';
import { SongTable, type Sort, type SortKey, type YearActions } from './components/SongTable';
import { pool, runImport, type ImportResult } from './importer';
import { parseImportText } from './parse';
import {
  addToCollection,
  applyYearHints,
  compareCollections,
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
  setCollectionSource,
  setYear,
  songYear,
  upsertSongs,
} from './library';
import { initBrowserPlayer } from './player';
import { getClientId, handleAuthCallback, isLoggedIn, isQuotaExceeded, login, logout, needsReconnect } from './spotify';
import { setLang, useLang, useT, type Lang } from './i18n';
import { setTheme, useTheme, type Theme } from './theme';
import type { Collection, CollectionSource, Library, Song } from './types';
import { earlierRelease, findOriginalRelease, type YearLookup } from './versions';

type SaveState = 'saved' | 'saving' | 'error';

const ALL = '__all__';
const UNSORTED = '__unsorted__';
const DUPLICATES = '__duplicates__';

type Page = 'library' | 'play';
const PAGE_KEY = 'sg.page';

export default function App() {
  const t = useT();
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

  // Start the browser player as soon as Spotify is connected, so it is ready when a game starts.
  useEffect(() => {
    if (connected) initBrowserPlayer();
  }, [connected]);

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
  /** Returns false when Spotify's quota is used up, so a bulk lookup can stop. */
  const findYear = useCallback(async (id: string) => {
    const song = libRef.current?.songs[id];
    if (!song) return true;
    const setLookup = (lookup: YearLookup) => setYearLookups((m) => ({ ...m, [id]: lookup }));
    setLookup({ state: 'loading' });
    try {
      setLookup({ state: 'done', release: await findOriginalRelease(song) });
    } catch (e) {
      setLookup({ state: 'error', message: e instanceof Error ? e.message : String(e) });
      return !isQuotaExceeded(e);
    }
    return true;
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
    () => Object.values(lib?.collections ?? {}).sort(compareCollections),
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
    let quotaHit = false;
    await pool(ids, 3, async (id) => {
      if (!quotaHit && !(await findYear(id))) quotaHit = true;
    });
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
          next = setCollectionSource(next, groupId, group.source);
          next = addToCollection(next, group.songIds, groupId);
        }
      }
      return next;
    });
  }

  // "Update from Spotify" for a collection made from Liked Songs, a playlist or an album.
  const [sync, setSync] = useState<{ id: string; busy: boolean; text: string } | null>(null);
  async function syncCollection(c: Collection) {
    if (!c.source || !libRef.current) return;
    const item = c.source.kind === 'liked' ? ({ kind: 'liked' } as const) : { kind: c.source.kind, id: c.source.id };
    const before = new Set(allSongs.filter((s) => s.collectionIds.includes(c.id)).map((s) => s.id));
    setSync({ id: c.id, busy: true, text: t.syncing });
    try {
      const result = await runImport([item], libRef.current, (text) => setSync({ id: c.id, busy: true, text }));
      const error = result.log.find((entry) => entry.level === 'error');
      if (error) throw new Error(error.text);
      handleImported(result, { collectionId: c.id, newCollectionName: null, collectionPerPlaylist: false });
      setSync({ id: c.id, busy: false, text: t.syncDone(result.songIds.filter((id) => !before.has(id)).length) });
    } catch (e) {
      setSync({ id: c.id, busy: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Ties an older collection to the Spotify playlist, album or Liked Songs it came from. */
  function linkSource(c: Collection) {
    const text = prompt(t.linkSourcePrompt);
    if (!text) return;
    const item = parseImportText(text).items.find((i) => i.kind !== 'track');
    const source: CollectionSource | null =
      item?.kind === 'liked'
        ? { kind: 'liked' }
        : item && item.kind !== 'track'
          ? { kind: item.kind, id: item.id }
          : null;
    if (!source) return alert(t.linkSourceInvalid);
    update((l) => setCollectionSource(l, c.id, source));
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
    const name = prompt(t.collectionNamePrompt);
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
        <h1>{t.loadErrorTitle}</h1>
        <p>{loadError}</p>
        <p className="muted">
          {t.loadErrorHelp} <code>npm run dev</code>.
        </p>
      </div>
    );
  }
  if (!lib) return <div className="fatal muted">{t.loadingLibrary}</div>;

  return (
    <div className={`app${page === 'play' ? ' play' : ''}`}>
      <header className="topbar">
        <h1>Song Guessr</h1>
        <nav className="page-tabs">
          {(['library', 'play'] as const).map((p) => (
            <button key={p} className={page === p ? 'active' : undefined} onClick={() => setPage(p)}>
              {p === 'library' ? t.navLibrary : t.navPlay}
            </button>
          ))}
        </nav>
        <span
          className={`save ${saveState}`}
          title={t.saveTitle}
        >
          {saveState === 'saving' ? t.saveSaving : saveState === 'error' ? t.saveFailed : t.saveSaved}
        </span>
        <div className="spacer" />
        {authError && <span className="error-text">{authError}</span>}
        {connected ? (
          <>
            {needsReconnect() ? (
              <button
                className="primary"
                title={t.reconnectTitle}
                onClick={() => login().catch((e) => setAuthError(e.message))}
              >
                {t.reconnect}
              </button>
            ) : (
              <span className="connected">{t.connected}</span>
            )}
            <button
              className="ghost"
              onClick={() => {
                logout();
                setConnected(false);
              }}
            >
              {t.disconnect}
            </button>
          </>
        ) : getClientId() ? (
          <button className="primary" onClick={() => login().catch((e) => setAuthError(e.message))}>
            {t.connect}
          </button>
        ) : (
          <button className="primary" onClick={() => setSettingsOpen(true)}>
            {t.setUpSpotify}
          </button>
        )}
        <LangToggle />
        <ThemeToggle />
        <button className="ghost icon" onClick={() => setSettingsOpen(true)} title={t.settingsTitle}>
          ⚙
        </button>
      </header>

      {page === 'library' ? (
        <>
          <aside className="sidebar">
            <nav>
              <SidebarItem label={t.allSongs} count={allSongs.length} active={view === ALL} onClick={() => setView(ALL)} />
              <SidebarItem
                label={t.unsorted}
                count={collectionCounts.unsorted}
                active={view === UNSORTED}
                onClick={() => setView(UNSORTED)}
              />
              {duplicates.length > 0 && (
                <SidebarItem
                  label={t.duplicates}
                  count={duplicates.length}
                  active={view === DUPLICATES}
                  onClick={() => setView(DUPLICATES)}
                />
              )}
              <h3>{t.collections}</h3>
              {collections.map((c) => (
                <SidebarItem
                  key={c.id}
                  icon={c.source ? (c.source.kind === 'liked' ? '♥' : '♫') : undefined}
                  label={c.name}
                  count={collectionCounts.counts[c.id] ?? 0}
                  active={view === c.id}
                  onClick={() => setView(c.id)}
                />
              ))}
              <button className="ghost new-collection" onClick={newCollection}>
                {t.newCollection(selected.size)}
              </button>
            </nav>
          </aside>

          <main className="main">
            <div className="view-header">
              <h2>
                {view === ALL
                  ? t.allSongs
                  : view === UNSORTED
                    ? t.unsorted
                    : view === DUPLICATES
                      ? t.duplicates
                      : activeCollection?.name}
              </h2>
              {activeCollection && (
                <>
                  <button
                    className="ghost small"
                    onClick={() => {
                      const name = prompt(t.renameCollectionPrompt, activeCollection.name);
                      if (name) update((l) => renameCollection(l, activeCollection.id, name));
                    }}
                  >
                    {t.rename}
                  </button>
                  <button
                    className="ghost small danger"
                    onClick={() => {
                      if (!confirm(t.confirmDeleteCollection(activeCollection.name))) return;
                      update((l) => deleteCollection(l, activeCollection.id));
                      setView(ALL);
                    }}
                  >
                    {t.deleteCollection}
                  </button>
                </>
              )}
              {activeCollection && !activeCollection.source && (
                <button className="ghost small" title={t.linkSourceTitle} onClick={() => linkSource(activeCollection)}>
                  {t.linkSource}
                </button>
              )}
              {activeCollection?.source && (
                <span className="source">
                  <span className="muted">
                    {activeCollection.source.kind === 'liked'
                      ? t.sourceLiked
                      : activeCollection.source.kind === 'playlist'
                        ? t.sourcePlaylist
                        : t.sourceAlbum}
                  </span>
                  <button
                    className="ghost small"
                    title={t.syncTitle}
                    disabled={!connected || (sync?.busy ?? false)}
                    onClick={() => syncCollection(activeCollection)}
                  >
                    {t.syncButton}
                  </button>
                  {sync?.id === activeCollection.id && <span className="muted">{sync.text}</span>}
                </span>
              )}
              <div className="spacer" />
              <button className={showImport ? 'ghost' : 'primary'} onClick={() => setShowImport((v) => !v)}>
                {showImport ? t.hideImport : t.addSongs}
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
                    placeholder={t.searchLibrary}
                  />
                  {suspectCount > 0 && (
                    <label className="inline" title={t.checkYearTitle}>
                      <input type="checkbox" checked={suspectOnly} onChange={(e) => setSuspectOnly(e.target.checked)} />
                      {t.checkYear(suspectCount)}
                    </label>
                  )}
                  {suspectCount > 0 && (
                    <button
                      className="ghost small"
                      disabled={!connected || findingYears}
                      title={t.findYearsTitle}
                      onClick={findAllYears}
                    >
                      {findingYears ? t.findingYears : t.findYears}
                    </button>
                  )}
                  {foundYears.length > 0 && (
                    <button
                      className="ghost small"
                      title={t.useFoundYearsTitle}
                      onClick={() => update((l) => foundYears.reduce((acc, f) => setYear(acc, f.id, f.year), l))}
                    >
                      {t.useFoundYears(foundYears.length)}
                    </button>
                  )}
                </div>

                {decadeCounts.length > 0 && (
                  <div className="decades" title={t.decadesTitle}>
                    {decadeCounts.map(([d, n]) => (
                      <button
                        key={d}
                        className={`decade${decade === d ? ' active' : ''}`}
                        onClick={() => setDecade(decade === d ? null : d)}
                      >
                        <span>{t.decadeShort(d)}</span>
                        <b>{n}</b>
                      </button>
                    ))}
                  </div>
                )}

                {selected.size > 0 && (
                  <div className="selection-bar">
                    <b>{t.selectedCount(selected.size)}</b>
                    <select
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id) update((l) => addToCollection(l, selected, id));
                      }}
                    >
                      <option value="">{t.addToCollection}</option>
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
                        {t.removeFrom(activeCollection.name)}
                      </button>
                    )}
                    <button
                      className="ghost danger"
                      onClick={() => {
                        if (!confirm(t.confirmDeleteSongs(selected.size))) return;
                        update((l) => deleteSongs(l, selected));
                        setSelected(new Set());
                      }}
                    >
                      {t.deleteFromLibrary}
                    </button>
                    <div className="spacer" />
                    <button className="ghost" onClick={() => setSelected(new Set())}>
                      {t.clearSelection}
                    </button>
                  </div>
                )}

                <p className="muted count">
                  {t.showing(shown.length, inView.length)}
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
  const t = useT();
  const { songs, suspectCount, decadeCounts } = props;
  const withYear = decadeCounts.reduce((sum, [, n]) => sum + n, 0);
  const [topDecade, topCount] = decadeCounts.reduce((top, d) => (d[1] > top[1] ? d : top), [0, 0]);
  const issues: ReactNode[] = [];
  if (songs.length < MIN_SONGS) issues.push(t.readyFewSongs(songs.length, MIN_SONGS));
  if (suspectCount > 0) {
    issues.push(
      <button key="suspect" className="link" onClick={props.onShowSuspects}>
        {t.readyYearsToCheck(suspectCount)}
      </button>,
    );
  }
  if (songs.length > withYear) issues.push(t.readyWithoutYear(songs.length - withYear));
  if (decadeCounts.length < 3) issues.push(t.readyFewDecades(decadeCounts.length));
  else if (topCount / withYear > MAX_DECADE_SHARE) {
    issues.push(t.readyDecadeShare(Math.round((topCount / withYear) * 100), t.decade(topDecade)));
  }
  const span = decadeCounts.length
    ? t.readySpan(decadeCounts.length, t.decade(decadeCounts[0][0]), t.decade(decadeCounts[decadeCounts.length - 1][0]))
    : t.readyNoYears;

  return (
    <div className={`readiness ${issues.length ? 'not-ready' : 'ready'}`}>
      <b>{issues.length ? t.readyNotQuite : t.readyOk}</b>
      <span className="muted">
        {t.readySongs(songs.length)} · {span}
      </span>
      {issues.map((issue, i) => (
        <span key={i} className="issue">
          {issue}
        </span>
      ))}
    </div>
  );
}

const THEMES: { theme: Theme; icon: string }[] = [
  { theme: 'auto', icon: '◐' },
  { theme: 'light', icon: '☀' },
  { theme: 'dark', icon: '☾' },
];

/** Cycles auto → light → dark. */
function ThemeToggle() {
  const t = useT();
  const theme = useTheme();
  const i = THEMES.findIndex((t) => t.theme === theme);
  const next = THEMES[(i + 1) % THEMES.length];
  return (
    <button
      className="ghost icon"
      onClick={() => setTheme(next.theme)}
      title={t.themeTitle(t.themeNames[theme], t.themeNames[next.theme])}
      aria-label={t.themeAria(t.themeNames[theme])}
    >
      {THEMES[i].icon}
    </button>
  );
}

const LANGS: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'EN' },
  { lang: 'da', label: 'DA' },
];

function LangToggle() {
  const t = useT();
  const lang = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label={t.languageTitle} title={t.languageTitle}>
      {LANGS.map((l) => (
        <button key={l.lang} className={lang === l.lang ? 'active' : undefined} onClick={() => setLang(l.lang)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function SidebarItem(props: { label: string; icon?: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item${props.active ? ' active' : ''}`} onClick={props.onClick}>
      <span>
        {props.icon && <span className="nav-icon">{props.icon}</span>}
        {props.label}
      </span>
      <span className="muted">{props.count}</span>
    </button>
  );
}
