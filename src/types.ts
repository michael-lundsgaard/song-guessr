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
  /** The recording's ISRC, for looking up its original year on MusicBrainz. Album pages don't include it. */
  isrc?: string;
  /** Result of the MusicBrainz original-year check (see yearCheck.ts); absent until the song is checked. */
  yearCheck?: YearCheck;
  addedAt: number;
  collectionIds: string[];
}

export interface YearCheck {
  /** Earliest first-release year MusicBrainz knows for the recording, or null when nothing matched. */
  year: number | null;
  /** 'isrc': the exact recording, trusted enough to use without asking. 'search': title + artist, a suggestion. */
  via: 'isrc' | 'search';
  /** The ISRC that was looked up, so a song that gets an ISRC later is checked again. */
  isrc?: string;
  checkedAt: number;
  /** The user decided the year after this check (typed a year, ✓ or took the suggestion): suggest nothing more. */
  settled?: boolean;
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
export type SongData = Omit<Song, 'addedAt' | 'collectionIds' | 'yearOverride' | 'yearConfirmed' | 'yearCheck'>;
