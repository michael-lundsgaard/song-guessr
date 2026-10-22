import { useEffect, useMemo, useState } from 'react';
import { runImport, type ImportResult, type LogEntry } from '../importer';
import { LIKED_SONGS_LINK, parseImportText } from '../parse';
import type { Library } from '../types';

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
  const [text, setText] = useState('');
  const [target, setTarget] = useState<string>(defaultCollectionId ?? '');
  const [newName, setNewName] = useState('');
  const [perPlaylist, setPerPlaylist] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);

  // Default the target to whichever collection is being viewed.
  useEffect(() => setTarget(defaultCollectionId ?? ''), [defaultCollectionId]);

  const items = useMemo(() => parseImportText(text), [text]);
  const counts = useMemo(() => {
    const c = { track: 0, playlist: 0, album: 0, search: 0, liked: 0 };
    items.forEach((i) => c[i.kind]++);
    return c;
  }, [items]);
  const collections = Object.values(lib.collections).sort((a, b) => a.name.localeCompare(b.name));

  async function run() {
    setBusy(true);
    setLog([]);
    try {
      const result = await runImport(items, lib, setProgress);
      onImported(result, {
        collectionId: target && target !== NEW ? target : null,
        newCollectionName: target === NEW && newName.trim() ? newName.trim() : null,
        collectionPerPlaylist: perPlaylist,
      });
      setLog([{ level: 'ok', text: `Imported ${result.songIds.length} songs` }, ...result.log]);
      if (!result.failed) setText('');
    } catch (e) {
      setLog([{ level: 'error', text: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  const summary = [
    counts.liked && 'Liked Songs',
    counts.track && `${counts.track} track links`,
    counts.playlist && `${counts.playlist} playlists`,
    counts.album && `${counts.album} albums`,
    counts.search && `${counts.search} text lines to search`,
  ].filter(Boolean);

  return (
    <section className="panel import">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={[
          'Paste one per line:',
          'https://open.spotify.com/playlist/…   (playlist → all its songs)',
          'https://open.spotify.com/track/…      (single song)',
          'Queen - Bohemian Rhapsody (1975)       (free text → Spotify search; the year is kept)',
          '',
          'Liked Songs                            (or use the button below)',
          '',
          'Tip: in the Spotify app, click a song, Ctrl+A, Ctrl+C, and paste here (copies the songs as links).',
        ].join('\n')}
        rows={8}
        spellCheck={false}
      />
      <div className="import-controls">
        <span className="muted">{summary.length ? summary.join(' · ') : 'Nothing to import yet'}</span>
        {!counts.liked && (
          <button
            className="ghost small"
            onClick={() => setText((t) => (t.trim() ? `${t.trimEnd()}\n` : '') + LIKED_SONGS_LINK)}
          >
            ♥ Liked Songs
          </button>
        )}
        <div className="spacer" />
        <label className="inline">
          Add to
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">No collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW}>+ New collection…</option>
          </select>
        </label>
        {target === NEW && (
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Collection name" />
        )}
        {(counts.playlist > 0 || counts.album > 0 || counts.liked > 0) && (
          <label className="inline">
            <input type="checkbox" checked={perPlaylist} onChange={(e) => setPerPlaylist(e.target.checked)} />
            Collection per playlist
          </label>
        )}
        <button className="primary" disabled={!connected || busy || !items.length} onClick={run}>
          {busy ? progress || 'Importing…' : 'Import'}
        </button>
      </div>
      {!connected && <p className="muted">Connect Spotify (top right) to import songs.</p>}
      {log.length > 0 && (
        <ul className="log">
          {log.map((entry, i) => (
            <li key={i} className={entry.level}>
              {entry.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
