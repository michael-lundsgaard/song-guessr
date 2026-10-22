import { useState } from 'react';
import { duplicateGroupKey, songYear } from '../library';
import type { Collection, Song } from '../types';

interface Props {
  groups: Song[][];
  collections: Record<string, Collection>;
  onMerge: (keepId: string, group: Song[]) => void;
  onIgnore: (group: Song[]) => void;
}

/** Versions of the same song (e.g. original and remaster), with a merge into the one to keep. */
export function DuplicatesView({ groups, collections, onMerge, onIgnore }: Props) {
  if (!groups.length) return <p className="empty">No duplicates found.</p>;
  return (
    <>
      <div className="toolbar">
        <p className="muted count">
          {groups.length} songs are in the library more than once. Merging keeps the chosen version, adds it to
          every collection of the others, and keeps the earliest year.
        </p>
        <div className="spacer" />
        <button
          className="ghost"
          title="Keep the preselected version of every song"
          onClick={() => groups.forEach((g) => onMerge(g[0].id, g))}
        >
          Merge all ({groups.length})
        </button>
      </div>
      {groups.map((group) => (
        <DuplicateGroup
          key={duplicateGroupKey(group)}
          group={group}
          collections={collections}
          onMerge={onMerge}
          onIgnore={onIgnore}
        />
      ))}
    </>
  );
}

function DuplicateGroup({
  group,
  collections,
  onMerge,
  onIgnore,
}: {
  group: Song[];
  collections: Record<string, Collection>;
  onMerge: Props['onMerge'];
  onIgnore: Props['onIgnore'];
}) {
  // Groups are sorted best version first: unflagged year, then earliest.
  const [keepId, setKeepId] = useState(group[0].id);
  return (
    <div className="panel duplicate">
      <table className="songs">
        <tbody>
          {group.map((s) => (
            <tr key={s.id} className={s.id === keepId ? 'selected' : undefined} onClick={() => setKeepId(s.id)}>
              <td className="check">
                <input type="radio" checked={s.id === keepId} onChange={() => setKeepId(s.id)} />
              </td>
              <td className="cover">{s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" />}</td>
              <td>
                <div className="title">{s.title}</div>
                <div className="muted">{s.artists.join(', ')}</div>
              </td>
              <td className="muted album">{s.album}</td>
              <td className="year">{songYear(s) ?? '?'}</td>
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
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="import-controls">
        <button className="primary" onClick={() => onMerge(keepId, group)}>
          Keep selected, merge {group.length - 1} other{group.length > 2 ? 's' : ''}
        </button>
        <button className="ghost" title="These are different songs — stop listing them" onClick={() => onIgnore(group)}>
          Not duplicates
        </button>
      </div>
    </div>
  );
}
