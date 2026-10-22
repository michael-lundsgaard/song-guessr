import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { runImport, type ImportResult, type LogEntry } from '../importer';
import { LIKED_SONGS_LINK, parseImportText } from '../parse';
import { searchTracks } from '../spotify';
import type { Library, SongData } from '../types';
import { PlayButton } from './PlayerBar';

export interface ImportTarget {
  collectionId: string | null;
  newCollectionName: string | null;
  collectionPerPlaylist: boolean;
}

interface Props {
  lib: Library;
  connected: boolean;
  defaultCollectionId: string | null;
  onImported: (result: ImportResult, target: ImportTarget) => void;
}

const NEW = '__new__';

export function ImportPanel({ lib, connected, defaultCollectionId, onImported }: Props) {
  const t = useT();
  const [tab, setTab] = useState<'paste' | 'search'>('paste');
  const [target, setTarget] = useState<string>(defaultCollectionId ?? '');
  const [newName, setNewName] = useState('');
  const [perPlaylist, setPerPlaylist] = useState(true);

  // Default the target to whichever collection is being viewed.
  useEffect(() => setTarget(defaultCollectionId ?? ''), [defaultCollectionId]);

  const collections = Object.values(lib.collections).sort((a, b) => a.name.localeCompare(b.name));
  const importTarget = (): ImportTarget => ({
    collectionId: target && target !== NEW ? target : null,
    newCollectionName: target === NEW && newName.trim() ? newName.trim() : null,
    collectionPerPlaylist: perPlaylist,
  });

  const targetPicker = (
    <>
      <label className="inline">
        {t.addTo}
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{t.noCollection}</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW}>{t.newCollectionOption}</option>
        </select>
      </label>
      {target === NEW && (
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.collectionNamePrompt} />
      )}
    </>
  );

  return (
    <section className="panel import">
      <div className="tabs">
        <button className={tab === 'paste' ? 'active' : undefined} onClick={() => setTab('paste')}>
          {t.tabPaste}
        </button>
        <button className={tab === 'search' ? 'active' : undefined} onClick={() => setTab('search')}>
          {t.tabSearch}
        </button>
      </div>
      {tab === 'paste' ? (
        <PasteImport
          lib={lib}
          connected={connected}
          targetPicker={targetPicker}
          perPlaylist={perPlaylist}
          setPerPlaylist={setPerPlaylist}
          onImport={(result) => onImported(result, importTarget())}
        />
      ) : (
        <SearchImport
          lib={lib}
          connected={connected}
          targetPicker={targetPicker}
          onAdd={(song) =>
            onImported(
              { fetched: [song], songIds: [song.id], groups: [], yearHints: {}, log: [], failed: 0 },
              importTarget(),
            )
          }
        />
      )}
      {!connected && <p className="muted">{t.connectToAdd}</p>}
    </section>
  );
}

function PasteImport(props: {
  lib: Library;
  connected: boolean;
  targetPicker: ReactNode;
  perPlaylist: boolean;
  setPerPlaylist: (v: boolean) => void;
  onImport: (result: ImportResult) => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);

  const { items, unrecognised } = useMemo(() => parseImportText(text), [text]);
  const counts = useMemo(() => {
    const c = { track: 0, playlist: 0, album: 0, liked: 0 };
    items.forEach((i) => c[i.kind]++);
    return c;
  }, [items]);

  async function run() {
    setBusy(true);
    setLog([]);
    try {
      const result = await runImport(items, props.lib, setProgress);
      props.onImport(result);
      setLog([{ level: 'ok', text: t.importedSongs(result.songIds.length) }, ...result.log]);
      if (!result.failed) setText('');
    } catch (e) {
      setLog([{ level: 'error', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  const summary = [
    counts.liked && t.likedSongs,
    counts.track && t.trackLinks(counts.track),
    counts.playlist && t.playlists(counts.playlist),
    counts.album && t.albums(counts.album),
    unrecognised && t.unrecognisedLines(unrecognised),
  ].filter(Boolean);

  return (
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.pastePlaceholder}
        rows={8}
        spellCheck={false}
      />
      <div className="import-controls">
        <span className="muted">{summary.length ? summary.join(' · ') : t.nothingToImport}</span>
        {!counts.liked && (
          <button
            className="ghost small"
            onClick={() => setText((prev) => (prev.trim() ? `${prev.trimEnd()}\n` : '') + LIKED_SONGS_LINK)}
          >
            {t.likedButton}
          </button>
        )}
        <div className="spacer" />
        {props.targetPicker}
        {(counts.playlist > 0 || counts.album > 0 || counts.liked > 0) && (
          <label className="inline">
            <input
              type="checkbox"
              checked={props.perPlaylist}
              onChange={(e) => props.setPerPlaylist(e.target.checked)}
            />
            {t.collectionPerPlaylist}
          </label>
        )}
        <button className="primary" disabled={!props.connected || busy || !items.length} onClick={run}>
          {busy ? progress || t.importing : t.importButton}
        </button>
      </div>
      {log.length > 0 && (
        <ul className="log">
          {log.map((entry, i) => (
            <li key={i} className={entry.level}>
              {entry.text}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Search as you type; each result is added with one click, so the right version is picked by eye. */
function SearchImport(props: {
  lib: Library;
  connected: boolean;
  targetPicker: ReactNode;
  onAdd: (song: SongData) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongData[]>([]);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q || !props.connected) return setResults([]);
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchTracks(q, 10)
        .then((r) => !cancelled && (setResults(r), setError('')))
        .catch((e) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setSearching(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, props.connected]);

  return (
    <>
      <div className="import-controls">
        <input
          className="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchSpotify}
          autoFocus
        />
        {props.targetPicker}
      </div>
      {error && <p className="error-text">{error}</p>}
      {searching && !results.length && <p className="muted">{t.searching}</p>}
      {results.length > 0 && (
        <table className="songs">
          <tbody>
            {results.map((s) => {
              const inLibrary = !!props.lib.songs[s.id];
              return (
                <tr key={s.id}>
                  <td className="cover">{s.imageUrl && <img src={s.imageUrl} alt="" />}</td>
                  <td>
                    <div className="title">{s.title}</div>
                    <div className="muted">{s.artists.join(', ')}</div>
                  </td>
                  <td className="muted album">
                    {s.album}
                    {s.albumType === 'compilation' && t.compilationSuffix}
                  </td>
                  <td className="year">{s.spotifyYear ?? '?'}</td>
                  <td className="actions">
                    <PlayButton song={s} />
                    {inLibrary ? (
                      <span className="muted">{t.inLibrary}</span>
                    ) : (
                      <button className="ghost small" onClick={() => props.onAdd(s)}>
                        {t.add}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
