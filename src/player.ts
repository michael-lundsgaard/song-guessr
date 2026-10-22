import { useSyncExternalStore } from 'react';
import {
  fetchDevices,
  fetchPlaybackState,
  getAccessToken,
  pauseDevice,
  playOnDevice,
  resumeDevice,
  seekDevice,
  setDeviceVolume,
  SpotifyError,
  type Device,
} from './spotify';
import { t } from './i18n';

// Plays songs either in this browser tab (Web Playback SDK, so the PC itself is a Spotify device) or on
// another Spotify Connect device such as the desktop app. One module-level store, read with usePlayer().

/** Device choice meaning "this browser tab". */
export const BROWSER = 'browser';

export interface NowPlaying {
  uri: string;
  durationMs: number;
  /** Where the song started; replay jumps back here. */
  startMs: number;
  /** A game song: the library must not show which one it is. */
  secret?: boolean;
}

export interface PlayerState {
  sdk: 'off' | 'loading' | 'ready' | 'error';
  sdkError: string;
  /** BROWSER or a Spotify Connect device id. */
  target: string;
  devices: Device[];
  current: NowPlaying | null;
  playing: boolean;
  /** Playback position at `positionAt` (a Date.now() timestamp); interpolate while playing. */
  positionMs: number;
  positionAt: number;
  volume: number;
  error: string;
}

const TARGET_KEY = 'sg.playTarget';
const VOLUME_KEY = 'sg.volume';

let state: PlayerState = {
  sdk: 'off',
  sdkError: '',
  target: localStorage.getItem(TARGET_KEY) || BROWSER,
  devices: [],
  current: null,
  playing: false,
  positionMs: 0,
  positionAt: 0,
  volume: Number(localStorage.getItem(VOLUME_KEY) ?? 0.7),
  error: '',
};
const listeners = new Set<() => void>();

function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** The current state, for code outside components. */
export const getPlayer = () => state;

export function usePlayer(): PlayerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Current position, interpolated since the last update while playing. */
export const positionNow = (s: PlayerState) =>
  s.playing ? s.positionMs + (Date.now() - s.positionAt) : s.positionMs;

// --- Web Playback SDK (only the parts we use) ---

interface SdkState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: { uri: string } | null };
}

interface SdkPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: 'ready' | 'not_ready', cb: (e: { device_id: string }) => void): void;
  addListener(event: 'player_state_changed', cb: (s: SdkState | null) => void): void;
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    cb: (e: { message: string }) => void,
  ): void;
  activateElement(): Promise<void>;
  togglePlay(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SdkPlayer;
    };
  }
}

let sdkPlayer: SdkPlayer | null = null;
let browserDeviceId: string | null = null;

const SDK_ERRORS = {
  initialization_error: () => t().sdkInitError,
  authentication_error: () => t().sdkAuthError,
  account_error: () => t().sdkAccountError,
};

/** Loads the Web Playback SDK and registers this tab as a Spotify device. Safe to call repeatedly. */
export function initBrowserPlayer() {
  if (state.sdk === 'loading' || state.sdk === 'ready') return;
  set({ sdk: 'loading', sdkError: '' });
  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new window.Spotify!.Player({
      name: 'Song Guessr',
      getOAuthToken: (cb) => void getAccessToken().then(cb, (e) => set({ sdk: 'error', sdkError: e.message })),
      volume: state.volume,
    });
    player.addListener('ready', ({ device_id }) => {
      browserDeviceId = device_id;
      set({ sdk: 'ready' });
    });
    player.addListener('not_ready', () => set({ sdk: 'loading' }));
    for (const event of ['initialization_error', 'authentication_error', 'account_error'] as const) {
      player.addListener(event, ({ message }) => set({ sdk: 'error', sdkError: SDK_ERRORS[event]() || message }));
    }
    player.addListener('playback_error', ({ message }) => set({ error: t().playbackFailed(message) }));
    player.addListener('player_state_changed', (s) => {
      if (state.target !== BROWSER) return;
      hideNowPlaying();
      if (!s) return set({ playing: false });
      set({ playing: !s.paused, positionMs: s.position, positionAt: Date.now() });
    });
    sdkPlayer = player;
    player.connect();
  };
  if (window.Spotify) window.onSpotifyWebPlaybackSDKReady();
  else {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = () => set({ sdk: 'error', sdkError: t().sdkLoadError });
    document.head.appendChild(script);
  }
}

/**
 * Chrome shows the media session's title in Windows' media overlay and its own media controls.
 * Keep it neutral so the song doesn't leak.
 */
function hideNowPlaying() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: 'Song Guessr', artist: 'Mystery song' });
}

// --- Device choice ---

export async function refreshDevices() {
  try {
    // The browser player is offered separately, so leave it out of the list.
    const devices = (await fetchDevices()).filter((d) => d.id !== browserDeviceId);
    set({ devices });
  } catch (e) {
    set({ error: describe(e) });
  }
}

export function selectTarget(target: string) {
  localStorage.setItem(TARGET_KEY, target);
  if (state.playing) void pause();
  set({ target, error: '' });
}

/**
 * The browser player's device, waiting for the player to finish starting (it registers with Spotify a
 * few seconds after the page loads, and a game may start before that).
 */
function readyDeviceId(timeoutMs = 10_000): Promise<string> {
  if (state.target !== BROWSER || (state.sdk === 'ready' && browserDeviceId)) return Promise.resolve(targetDeviceId());
  initBrowserPlayer();
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      listeners.delete(check);
    };
    const check = () => {
      if (state.sdk === 'ready' && browserDeviceId) {
        done();
        resolve(browserDeviceId);
      } else if (state.sdk === 'error') {
        done();
        reject(new Error(state.sdkError));
      }
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error(t().browserPlayerStarting));
    }, timeoutMs);
    listeners.add(check);
  });
}

function targetDeviceId(): string {
  if (state.target !== BROWSER) return state.target;
  if (!browserDeviceId || state.sdk !== 'ready') {
    throw new Error(state.sdkError || t().browserPlayerStarting);
  }
  return browserDeviceId;
}

// --- Controls ---

/** A start position somewhere in the middle of the song, leaving at least 45 seconds to listen. */
function randomStart(durationMs: number) {
  const earliest = durationMs * 0.15;
  const latest = durationMs - 45_000;
  return latest > earliest ? Math.round(earliest + Math.random() * (latest - earliest)) : 0;
}

/** Plays a song. Call from a click handler: browsers only allow audio after a user gesture. */
export async function play(song: { uri: string; durationMs: number }, options: { randomStart?: boolean; startMs?: number; secret?: boolean } = {}) {
  // Must run synchronously inside the gesture, before any await.
  if (state.target === BROWSER) void sdkPlayer?.activateElement();
  const startMs = options.startMs ?? (options.randomStart ? randomStart(song.durationMs) : 0);
  const current = { uri: song.uri, durationMs: song.durationMs, startMs, secret: options.secret };
  set({ current, playing: true, positionMs: startMs, positionAt: Date.now(), error: '' });
  await run(async () => {
    const deviceId = await readyDeviceId();
    try {
      await playOnDevice(deviceId, song.uri, startMs);
    } catch (e) {
      // A freshly registered browser device can take a moment to show up in Spotify Connect.
      if (!(e instanceof SpotifyError && e.status === 404)) throw e;
      await new Promise((r) => setTimeout(r, 1000));
      await playOnDevice(deviceId, song.uri, startMs);
    }
    if (state.target !== BROWSER) void setDeviceVolume(deviceId, state.volume * 100).catch(() => {});
  });
}

export async function pause() {
  set({ playing: false, positionMs: positionNow(state), positionAt: Date.now() });
  await run(() => (state.target === BROWSER ? sdkPlayer!.pause() : pauseDevice(targetDeviceId())));
}

export async function resume() {
  if (!state.current) return;
  if (state.target === BROWSER) void sdkPlayer?.activateElement();
  set({ playing: true, positionAt: Date.now() });
  await run(() => (state.target === BROWSER ? sdkPlayer!.resume() : resumeDevice(targetDeviceId())));
}

export const togglePlay = () => (state.playing ? pause() : resume());

/** Jumps back to where the current song started. */
export async function replay() {
  const current = state.current;
  if (!current) return;
  if (state.target === BROWSER) void sdkPlayer?.activateElement();
  set({ playing: true, positionMs: current.startMs, positionAt: Date.now() });
  await run(async () => {
    if (state.target === BROWSER) {
      await sdkPlayer!.seek(current.startMs);
      await sdkPlayer!.resume();
    } else {
      const deviceId = targetDeviceId();
      await seekDevice(deviceId, current.startMs);
      await resumeDevice(deviceId).catch(() => {}); // 403 when it is already playing
    }
  });
}

export async function setVolume(volume: number) {
  localStorage.setItem(VOLUME_KEY, String(volume));
  set({ volume });
  await run(() =>
    state.target === BROWSER ? (sdkPlayer?.setVolume(volume) ?? Promise.resolve()) : setDeviceVolume(targetDeviceId(), volume * 100),
  );
}

async function run(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (e) {
    set({ error: describe(e), playing: false });
  }
}

function describe(e: unknown) {
  if (e instanceof SpotifyError && e.status === 404) return t().deviceGone;
  if (e instanceof SpotifyError && e.status === 403) return t().needsPremium(e.message);
  return e instanceof Error ? e.message : String(e);
}

// Spotify Connect devices don't push their state, so poll it while something plays there.
setInterval(async () => {
  if (state.target === BROWSER || !state.current || document.hidden) return;
  try {
    const s = await fetchPlaybackState();
    const ours = s?.device?.id === state.target && s.item?.uri === state.current?.uri;
    set({ playing: !!ours && s!.is_playing, positionMs: s?.progress_ms ?? state.positionMs, positionAt: Date.now() });
  } catch {
    // Polling is best effort; real errors surface on the next command.
  }
}, 3000);
