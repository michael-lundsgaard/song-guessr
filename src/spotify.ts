import type { SongData } from './types';

const AUTH_URL = 'https://accounts.spotify.com';
const API_URL = 'https://api.spotify.com/v1';
// Playback scopes are requested up front so game modes can control playback later without re-login.
const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming',
].join(' ');
const CLIENT_ID_KEY = 'sg.spotifyClientId';
const TOKEN_KEY = 'sg.spotifyToken';
const VERIFIER_KEY = 'sg.pkceVerifier';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
}

export class SpotifyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const redirectUri = () => `${window.location.origin}/`;

// The app's Spotify Client ID. It's public (PKCE needs no secret) and only accounts listed under
// User Management in the Spotify dashboard can log in. Overridable from the app's settings.
const DEFAULT_CLIENT_ID = '603de77fd6b44b6bab5c65fb6169a9d1';

export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) || DEFAULT_CLIENT_ID;
}

export function setClientId(id: string) {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}

function readToken(): StoredToken | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function saveToken(json: any, previous?: StoredToken) {
  const token: StoredToken = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? previous?.refreshToken ?? '',
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope ?? previous?.scope,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export const isLoggedIn = () => readToken() !== null;

/** True when the login predates permissions the app now asks for, so the user must reconnect. */
export function needsReconnect() {
  const granted = new Set(readToken()?.scope?.split(' ') ?? []);
  return isLoggedIn() && SCOPES.split(' ').some((s) => !granted.has(s));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Starts the Authorization Code + PKCE flow (no client secret needed). */
export async function login() {
  const clientId = getClientId();
  if (!clientId) throw new Error('Set your Spotify Client ID in settings first.');
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.assign(`${AUTH_URL}/authorize?${params}`);
}

/** Completes login if the current URL is Spotify's redirect back to us. */
export async function handleAuthCallback(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) return;
  window.history.replaceState({}, '', url.pathname);
  if (error) throw new Error(`Spotify login failed: ${error}`);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  if (!verifier) throw new Error('Login state was lost — please try connecting again.');
  const json = await tokenRequest({
    grant_type: 'authorization_code',
    code: code!,
    redirect_uri: redirectUri(),
    client_id: getClientId(),
    code_verifier: verifier,
  });
  saveToken(json);
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${AUTH_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? `Token request failed (${res.status})`);
  return json;
}

let refreshing: Promise<string> | null = null;

async function accessToken(forceRefresh = false): Promise<string> {
  const token = readToken();
  if (!token) throw new Error('Not connected to Spotify.');
  if (!forceRefresh && Date.now() < token.expiresAt - 60_000) return token.accessToken;
  // Share one refresh between concurrent requests; refresh tokens may rotate.
  refreshing ??= tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    client_id: getClientId(),
  })
    .then((json) => {
      saveToken(json, token);
      return json.access_token as string;
    })
    .catch(() => {
      logout();
      throw new Error('Spotify session expired — please connect again.');
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apiGet<T>(pathOrUrl: string, attempt = 0): Promise<T> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : API_URL + pathOrUrl;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (res.status === 429 && attempt < 5) {
    await sleep(Number(res.headers.get('Retry-After') ?? 2) * 1000);
    return apiGet(pathOrUrl, attempt + 1);
  }
  if (res.status === 401 && attempt === 0) {
    await accessToken(true);
    return apiGet(pathOrUrl, attempt + 1);
  }
  if (!res.ok) {
    // Error bodies are usually JSON, but some (e.g. "user may not be registered") are plain text.
    const body = await res.text().catch(() => '');
    let message = body.trim() || `HTTP ${res.status}`;
    try {
      message = JSON.parse(body).error?.message ?? message;
    } catch {}
    throw new SpotifyError(res.status, `HTTP ${res.status}: ${message}`);
  }
  return res.json();
}

// --- Spotify objects (only the fields we use) ---

interface SpAlbum {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  images: { url: string; width: number | null }[];
}

interface SpTrack {
  id: string | null;
  uri: string;
  name: string;
  type?: string;
  is_local?: boolean;
  duration_ms: number;
  artists: { name: string }[];
  album?: SpAlbum;
}

interface Paging<T> {
  items: T[];
  next: string | null;
}

function toSongData(t: SpTrack | null | undefined, album?: SpAlbum): SongData | null {
  const al = t?.album ?? album;
  if (!t || !t.id || t.is_local || (t.type && t.type !== 'track') || !al) return null;
  const year = parseInt(al.release_date?.slice(0, 4) ?? '', 10);
  // Images are sorted largest first; the ~300px one is plenty for the library and game cards.
  const image = al.images[1] ?? al.images[0];
  return {
    id: t.id,
    uri: t.uri,
    title: t.name,
    artists: t.artists.map((a) => a.name),
    album: al.name,
    albumType: al.album_type,
    releaseDate: al.release_date ?? '',
    spotifyYear: Number.isNaN(year) ? null : year,
    durationMs: t.duration_ms,
    imageUrl: image?.url,
  };
}

export interface TrackList {
  name: string;
  tracks: SongData[];
  skipped: number;
}

export async function fetchTrack(id: string): Promise<SongData | null> {
  return toSongData(await apiGet<SpTrack>(`/tracks/${id}`));
}

export async function fetchPlaylist(id: string, onProgress?: (count: number) => void): Promise<TrackList> {
  const meta = await apiGet<{ name: string }>(`/playlists/${id}?fields=name`);
  // Newer API versions expose playlist contents at /items (with `item`), older at /tracks (with `track`).
  type Entry = { item?: SpTrack | null; track?: SpTrack | null };
  let page: Paging<Entry>;
  try {
    page = await apiGet<Paging<Entry>>(`/playlists/${id}/items?limit=50`);
  } catch (e) {
    if (!(e instanceof SpotifyError) || e.status !== 404) throw e;
    page = await apiGet<Paging<Entry>>(`/playlists/${id}/tracks?limit=50`);
  }
  const tracks: SongData[] = [];
  let skipped = 0;
  for (;;) {
    // Development-mode apps only get contents of playlists the user owns or collaborates on.
    if (!Array.isArray(page?.items)) throw new SpotifyError(403, 'playlist contents not available');
    for (const entry of page.items) {
      const song = toSongData(entry.item ?? entry.track);
      if (song) tracks.push(song);
      else skipped++;
    }
    onProgress?.(tracks.length);
    if (!page.next) break;
    page = await apiGet<Paging<Entry>>(page.next);
  }
  return { name: meta.name, tracks, skipped };
}

/** The user's Liked Songs (Spotify's "Your Music" library), oldest first. */
export async function fetchLikedSongs(onProgress?: (count: number) => void): Promise<TrackList> {
  const tracks: SongData[] = [];
  let skipped = 0;
  let next: string | null = '/me/tracks?limit=50';
  while (next) {
    const page: Paging<{ track: SpTrack | null }> = await apiGet(next);
    for (const entry of page.items) {
      const song = toSongData(entry.track);
      if (song) tracks.push(song);
      else skipped++;
    }
    onProgress?.(tracks.length);
    next = page.next;
  }
  return { name: 'Liked Songs', tracks: tracks.reverse(), skipped };
}

export async function fetchAlbum(id: string): Promise<TrackList> {
  const album = await apiGet<SpAlbum & { tracks: Paging<SpTrack> }>(`/albums/${id}`);
  const tracks: SongData[] = [];
  let page = album.tracks;
  for (;;) {
    for (const t of page.items) {
      const song = toSongData(t, album);
      if (song) tracks.push(song);
    }
    if (!page.next) break;
    page = await apiGet<Paging<SpTrack>>(page.next);
  }
  return { name: album.name, tracks, skipped: 0 };
}

export async function searchTrack(query: string): Promise<SongData | null> {
  const params = new URLSearchParams({ q: query, type: 'track', limit: '1' });
  const res = await apiGet<{ tracks: Paging<SpTrack> }>(`/search?${params}`);
  return toSongData(res.tracks.items[0]);
}
