import { useEffect, type ReactNode } from 'react';
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
import { useT } from '../i18n';

/** ▶ for one song: plays it, or pauses/resumes it when it is the song already playing. */
export function PlayButton({ song }: { song: { uri: string; durationMs: number } }) {
  const t = useT();
  const p = usePlayer();
  const isCurrent = p.current?.uri === song.uri;
  return (
    <button
      className="mini play"
      title={isCurrent && p.playing ? t.pause : t.play}
      onClick={() => (isCurrent ? togglePlay() : play(song))}
    >
      {isCurrent && p.playing ? '❚❚' : '▶'}
    </button>
  );
}

/**
 * Where songs play, plus play/pause, replay and volume for the current song. Game screens pass their own
 * `actions` (left) and `end` (right, e.g. the main game button) and leave out `titleFor`.
 */
export function PlayerBar({
  connected,
  titleFor,
  actions,
  end,
}: {
  connected: boolean;
  /** Names the current song; leave out to keep it hidden (game screens). */
  titleFor?: (uri: string) => string | undefined;
  actions?: ReactNode;
  end?: ReactNode;
}) {
  const t = useT();
  const p = usePlayer();
  useEffect(() => {
    if (!connected) return;
    initBrowserPlayer();
    void refreshDevices();
  }, [connected]);
  if (!connected && !actions && !end) return null;

  const browserStatus =
    p.sdk === 'ready' ? '' : p.sdk === 'error' ? t.browserUnavailable : p.sdk === 'loading' ? t.browserStarting : '';
  const knownTarget = p.target === BROWSER || p.devices.some((d) => d.id === p.target);

  return (
    <div className="player-bar">
      {actions ?? (
        <>
          <button className="mini" disabled={!p.current} onClick={() => replay()} title={t.replayTitle}>
            ⟲
          </button>
          <button className="mini play" disabled={!p.current} onClick={() => togglePlay()} title={t.playPauseTitle}>
            {p.playing ? '❚❚' : '▶'}
          </button>
          <span className="now muted">{p.current ? (titleFor?.(p.current.uri) ?? '') : t.nothingPlaying}</span>
        </>
      )}
      {p.error && <span className="error-text">{p.error}</span>}
      {p.target === BROWSER && p.sdk === 'error' && <span className="error-text">{p.sdkError}</span>}
      <div className="spacer" />
      {connected && (
        <>
          <label className="inline" title={t.volume}>
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
            {t.playOn}
            <select
              value={p.target}
              onFocus={() => refreshDevices()}
              onChange={(e) => selectTarget(e.target.value)}
              title={t.playOnTitle}
            >
              <option value={BROWSER}>
                {t.thisBrowser}
                {browserStatus}
              </option>
              {p.devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type.toLowerCase()})
                </option>
              ))}
              {!knownTarget && <option value={p.target}>{t.lastDevice}</option>}
            </select>
          </label>
        </>
      )}
      {end}
    </div>
  );
}
