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
  /** The user checked a ⚠ year and Spotify's year is right, so it is no longer flagged. */
  yearConfirmed?: boolean;
  durationMs: number;
  imageUrl?: string;
  addedAt: number;
  collectionIds: string[];
}

/** Where a collection came from on Spotify, so it can be updated from there. */
export type CollectionSource = { kind: 'liked' } | { kind: 'playlist' | 'album'; id: string };

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  source?: CollectionSource;
}

export interface Library {
  version: 1;
  songs: Record<string, Song>;
  collections: Record<string, Collection>;
  /** Duplicate groups the user marked as different songs (see duplicateGroupKey). */
  ignoredDuplicates: string[];
}

/** Song metadata as fetched from Spotify, before it becomes part of the library. */
export type SongData = Omit<Song, 'addedAt' | 'collectionIds' | 'yearOverride' | 'yearConfirmed'>;
