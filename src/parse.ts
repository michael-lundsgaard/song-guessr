export type ImportItem = { kind: 'track' | 'playlist' | 'album'; id: string; yearHint?: number } | { kind: 'liked' };

export interface ParsedImport {
  items: ImportItem[];
  /** Lines with no Spotify link on them (free text is searched in the Search tab instead). */
  unrecognised: number;
}

/** What the Liked Songs link looks like when copied from Spotify; also inserted by the import button. */
export const LIKED_SONGS_LINK = 'https://open.spotify.com/collection/tracks';
const LIKED_RE = /open\.spotify\.com\/collection\/tracks|spotify:collection|^liked songs$/i;

const LINK_RE =
  /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?|spotify:)(track|playlist|album)[/:]([A-Za-z0-9]{22})/g;
const YEAR_RE = /[([]\s*((?:19|20)\d{2})\s*[)\]]/;

/**
 * One item per line: Spotify links/URIs for tracks, playlists and albums (several per line is fine).
 * A "(1975)" on a line with a single link is kept as that song's year.
 */
export function parseImportText(text: string): ParsedImport {
  const items: ImportItem[] = [];
  const seen = new Set<string>();
  let unrecognised = 0;
  const push = (key: string, item: ImportItem) => {
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (LIKED_RE.test(line)) {
      push('liked', { kind: 'liked' });
      continue;
    }
    const links = [...line.matchAll(LINK_RE)];
    if (!links.length) {
      unrecognised++;
      continue;
    }
    const yearMatch = line.match(YEAR_RE);
    for (const [, kind, id] of links) {
      push(`${kind}:${id}`, {
        kind: kind as 'track' | 'playlist' | 'album',
        id,
        yearHint: links.length === 1 && yearMatch ? Number(yearMatch[1]) : undefined,
      });
    }
  }
  return { items, unrecognised };
}
