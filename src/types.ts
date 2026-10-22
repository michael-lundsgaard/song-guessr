export interface Song {
  id: string; // Spotify track id
  uri: string;
  title: string;
  artists: string[];
  album: string;
  albumType: string;
  releaseDate: string;
  spotifyYear: number | null;
  /** Manually corrected year (Spotify often reports the remaster/compilation year). */
  yearOverride?: number | null;
  durationMs: number;
  imageUrl?: string;
  addedAt: number;
  collectionIds: string[];
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

export interface Library {
  version: 1;
  songs: Record<string, Song>;
  collections: Record<string, Collection>;
  /** Free-text search query (lowercased) -> matched track id, so searches are not repeated. */
  searchCache: Record<string, string>;
}

/** Song metadata as fetched from Spotify, before it becomes part of the library. */
export type SongData = Omit<Song, 'addedAt' | 'collectionIds' | 'yearOverride'>;
