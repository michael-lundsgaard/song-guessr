import { useEffect } from 'react';
import {
  BROWSER,
  initBrowserPlayer,
  play,
  refreshDevices,
  replay,
  selectTarget,
  setVolume,
  togglePlay,
  usePlayer,
} from '../player';

/** ▶ for one song: plays it, or pauses/resumes it when it is the song already playing. */
export function PlayButton({ song }: { song: { uri: string; durationMs: number } }) {
  const p = usePlayer();
  const isCurrent = p.current?.uri === song.uri;
  return (
    <button
      className="mini play"
      title={isCurrent && p.playing ? 'Pause' : 'Play'}
      onClick={() => (isCurrent ? togglePlay() : play(song))}
    >
      {isCurrent && p.playing ? '❚❚' : '▶'}
    </button>
  );
}

/** Where songs play, plus play/pause, replay and volume for the current song. */
export function PlayerBar({
  connected,
  titleFor,
}: {
  connected: boolean;
  /** Names the current song; leave out to keep it hidden (game screens). */
  titleFor?: (uri: string) => string | undefined;
}) {
  const p = usePlayer();
  useEffect(() => {
    if (!connected) return;
    initBrowserPlayer();
    void refreshDevices();
  }, [connected]);
  if (!connected) return null;

  const browserStatus =
    p.sdk === 'ready' ? '' : p.sdk === 'error' ? ' (unavailable)' : p.sdk === 'loading' ? ' (starting…)' : '';
  const knownTarget = p.target === BROWSER || p.devices.some((d) => d.id === p.target);

  return (
    <div className="player-bar">
      <button className="mini" disabled={!p.current} onClick={() => replay()} title="Play again from the start">
        ⟲
      </button>
      <button className="mini play" disabled={!p.current} onClick={() => togglePlay()} title="Play / pause">
        {p.playing ? '❚❚' : '▶'}
      </button>
      <span className="now muted">{p.current ? (titleFor?.(p.current.uri) ?? '') : 'Nothing playing'}</span>
      {p.error && <span className="error-text">{p.error}</span>}
      {p.target === BROWSER && p.sdk === 'error' && <span className="error-text">{p.sdkError}</span>}
      <div className="spacer" />
      <label className="inline" title="Volume">
        🔊
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={p.volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>
      <label className="inline">
        Play on
        <select
          value={p.target}
          onFocus={() => refreshDevices()}
          onChange={(e) => selectTarget(e.target.value)}
          title="Play in this browser tab, or on another Spotify device (open the Spotify app there first)"
        >
          <option value={BROWSER}>This browser{browserStatus}</option>
          {p.devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.type.toLowerCase()})
            </option>
          ))}
          {!knownTarget && <option value={p.target}>Last used device (not found)</option>}
        </select>
      </label>
    </div>
  );
}
