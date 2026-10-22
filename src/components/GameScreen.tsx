import { useEffect, useRef, useState } from 'react';
import { compareTeams, endGame, markPlayed, nextTurn, place, reveal, toggleAward, type Game } from '../game';
import { isYearSuspect, songYear } from '../library';
import { pause, play, replay, togglePlay, usePlayer } from '../player';
import type { Library, Song } from '../types';
import { PlayerBar } from './PlayerBar';
import { useT } from '../i18n';

interface Props {
  lib: Library;
  connected: boolean;
  game: Game;
  onChange: (game: Game) => void;
  onNewGame: () => void;
}

/** A ⚠ year may be a later remaster/compilation year: show it as approximate. */
const yearLabel = (s: Song) => `${isYearSuspect(s) ? '≈ ' : ''}${songYear(s) ?? '?'}`;

export function GameScreen({ lib, connected, game, onChange, onNewGame }: Props) {
  const t = useT();
  const player = usePlayer();
  const round = game.round;
  const song = round ? lib.songs[round.songId] : null;
  const team = game.teams[game.turn];
  const isPlayingRound = !!song && player.current?.uri === song.uri;
  const isTimeline = game.setup.mode === 'timeline';

  // Timeline: the slot the team picked, placed only once they confirm.
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);
  useEffect(() => setPendingSlot(null), [round?.songId]);
  function confirmPlacement() {
    if (pendingSlot == null) return;
    onChange(place(game, lib, pendingSlot));
    setPendingSlot(null);
  }

  function playSong(s: Song) {
    void play(s, { randomStart: game.setup.randomStart });
    markPlayed(s.id);
  }

  function next() {
    const updated = nextTurn(game);
    onChange(updated);
    // Still inside the click/key event, so the browser lets the next song start right away.
    const nextSong = updated.round && lib.songs[updated.round.songId];
    if (nextSong) playSong(nextSong);
    else void pause();
  }

  function finish() {
    if (!confirm(t.confirmEndGame)) return;
    void pause();
    onChange(endGame(game));
  }

  // Keyboard: space = play/pause, R = replay, Enter = reveal, → = next song.
  const keys = useRef<(e: KeyboardEvent) => void>();
  keys.current = (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (isPlayingRound) void togglePlay();
      else if (song) playSong(song);
    } else if (e.key === 'r' || e.key === 'R') {
      if (isPlayingRound) void replay();
    } else if (e.key === 'Enter' && round && !round.revealed) {
      e.preventDefault();
      if (isTimeline) confirmPlacement();
      else onChange(reveal(game));
    } else if (e.key === 'ArrowRight' && round?.revealed) {
      next();
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keys.current?.(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (game.winner != null) {
    const ranked = [...game.teams].sort(compareTeams);
    return (
      <div className="game">
        <div className="winner">
          <div className="trophy">🏆</div>
          <h2>{game.winner >= 0 ? t.wins(game.teams[game.winner].name) : t.draw}</h2>
          <ol className="final-scores">
            {ranked.map((team) => (
              <li key={team.name}>
                {team.name} <b>{team.score}</b>
                {game.setup.extraPoints && <span className="muted">{t.extraSuffix(team.bonus ?? 0)}</span>}
              </li>
            ))}
          </ol>
          <p className="muted">{t.songsPlayed(game.roundsPlayed)}</p>
          <button className="primary big" onClick={onNewGame}>
            {t.newGame}
          </button>
        </div>
      </div>
    );
  }

  const mainAction = !round ? null : round.revealed ? (
    <button className="primary big" onClick={next}>
      {t.nextSong}
    </button>
  ) : isTimeline ? (
    <button className="primary big" disabled={pendingSlot == null} onClick={confirmPlacement}>
      {pendingSlot == null ? t.pickSpot : t.confirmPlacement}
    </button>
  ) : (
    <button className="primary big" onClick={() => onChange(reveal(game))}>
      {t.reveal}
    </button>
  );

  return (
    <div className={`game mode-${game.setup.mode}`}>
      <div className="scoreboard">
        {game.teams.map((team, i) => (
          <div key={i} className={`team-score${i === game.turn ? ' current' : ''}`}>
            <span>{team.name}</span>
            <b>{team.score}</b>
            {isTimeline && game.setup.extraPoints && (
              <span className="muted small-note" title={t.extraOnlyTie}>
                +{team.bonus ?? 0}
              </span>
            )}
          </div>
        ))}
        <div className="spacer" />
        <span className="muted">
          {t.progress(game.roundsPlayed + 1, game.deck.length, game.setup.target)}
        </span>
        <button className="ghost small" onClick={finish}>
          {t.endGame}
        </button>
      </div>

      {song && round && (
        <div className="stage">
          {round.revealed ? (
            <RevealedCard song={song} />
          ) : (
            <div className={`card hidden-card${isPlayingRound && player.playing ? ' playing' : ''}`}>
              <div className="mystery">?</div>
              <div className="equalizer" aria-hidden>
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          )}

          <div className="stage-info">
            <p className="turn">
              <b>{t.turn(team.name)}</b>
            </p>
            {!round.revealed && (
              <p className="muted hint">
                {isTimeline ? t.hintTimeline : t.hintGuess}
              </p>
            )}
            {isTimeline && round.revealed && (
              <p className={`verdict ${round.correct ? 'right' : 'wrong'}`}>
                {round.correct ? t.correct : t.wrong(yearLabel(song))}
              </p>
            )}
            {round.awarded && (
              <div className="awards">
                {isTimeline && <span className="muted">{t.extraPointsLabel}</span>}
                {(['title', 'artist', 'year'] as const).map((field) => (
                  <button
                    key={field}
                    className={`award${round.awarded![field] ? ' on' : ''}`}
                    onClick={() => onChange(toggleAward(game, field))}
                  >
                    {round.awarded![field] ? '✓' : '+1'}{' '}
                    {field === 'title' ? t.awardTitle : field === 'artist' ? t.awardArtist : isTimeline ? t.awardExactYear : t.awardYear}
                  </button>
                ))}
              </div>
            )}
            {player.error && <p className="error-text">{player.error}</p>}
          </div>
        </div>
      )}

      {isTimeline && round && (
        <Timeline
          lib={lib}
          ids={team.timeline}
          placing={!round.revealed}
          selected={pendingSlot}
          highlight={round.revealed && round.correct ? round.songId : undefined}
          onSelect={setPendingSlot}
        />
      )}

      <PlayerBar
        connected={connected}
        actions={
          song && (
            <>
              <button className="mini big-icon" disabled={!isPlayingRound} onClick={() => replay()} title={t.replayKey}>
                ⟲
              </button>
              <button
                className="mini big-icon play"
                onClick={() => (isPlayingRound ? togglePlay() : playSong(song))}
                title={t.playPauseKey}
              >
                {isPlayingRound && player.playing ? '❚❚' : '▶'}
              </button>
            </>
          )
        }
        end={mainAction}
      />
    </div>
  );
}

function RevealedCard({ song }: { song: Song }) {
  const t = useT();
  return (
    <div className="card revealed-card">
      {song.imageUrl && <img src={song.imageUrl} alt="" />}
      <div className="card-year" title={isYearSuspect(song) ? t.approxYearTitle : undefined}>
        {yearLabel(song)}
      </div>
      <div className="card-title">{song.title}</div>
      <div className="card-artist">{song.artists.join(', ')}</div>
    </div>
  );
}

function Timeline(props: {
  lib: Library;
  ids: string[];
  placing: boolean;
  /** The slot picked but not yet confirmed. */
  selected: number | null;
  highlight?: string;
  onSelect: (index: number) => void;
}) {
  const t = useT();
  const slot = (index: number) =>
    props.placing && (
      <button
        key={`slot-${index}`}
        className={`slot${props.selected === index ? ' selected' : ''}`}
        onClick={() => props.onSelect(index)}
        title={t.placeHere}
      >
        {props.selected === index ? '?' : '+'}
      </button>
    );
  return (
    <div className="timeline">
      {props.ids.map((id, i) => {
        const s = props.lib.songs[id];
        return [
          slot(i),
          <div key={id} className={`mini-card${id === props.highlight ? ' new' : ''}`}>
            <b>{yearLabel(s)}</b>
            <span className="clip">{s.title}</span>
            <span className="muted clip">{s.artists[0]}</span>
          </div>,
        ];
      })}
      {slot(props.ids.length)}
    </div>
  );
}
