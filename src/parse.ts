export type ImportItem =
  | { kind: 'track' | 'playlist' | 'album'; id: string; yearHint?: number }
  | { kind: 'search'; query: string; yearHint?: number }
  | { kind: 'liked' };

/** What the Liked Songs link looks like when copied from Spotify; also inserted by the import button. */
export const LIKED_SONGS_LINK = 'https://open.spotify.com/collection/tracks';
const LIKED_RE = /open\.spotify\.com\/collection\/tracks|spotify:collection|^liked songs$/i;

const LINK_RE =
  /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?|spotify:)(track|playlist|album)[/:]([A-Za-z0-9]{22})/g;
const YEAR_RE = /[([]\s*((?:19|20)\d{2})\s*[)\]]/;

/**
 * One item per line. Accepts Spotify links/URIs (tracks, playlists, albums — several per line is fine)
 * or free text like "1. Queen - Bohemian Rhapsody (1975)", which becomes a search.
 * A "(1975)" on the line is kept as the song's year.
 */
export function parseImportText(text: string): ImportItem[] {
  const items: ImportItem[] = [];
  const seen = new Set<string>();
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
    const yearMatch = line.match(YEAR_RE);
    const yearHint = yearMatch ? Number(yearMatch[1]) : undefined;

    const links = [...line.matchAll(LINK_RE)];
    if (links.length) {
      for (const [, kind, id] of links) {
        push(`${kind}:${id}`, {
          kind: kind as 'track' | 'playlist' | 'album',
          id,
          yearHint: links.length === 1 ? yearHint : undefined,
        });
      }
      continue;
    }

    const query = (yearMatch ? line.replace(yearMatch[0], ' ') : line)
      .replace(/^\d+[.)]\s+/, '')
      .replace(/\s[-–—]\s/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (query) push(`search:${query.toLowerCase()}`, { kind: 'search', query, yearHint });
  }
  return items;
}
