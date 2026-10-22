import { useEffect, useRef } from 'react';
import { endGame, markPlayed, nextTurn, place, reveal, toggleAward, type Game } from '../game';
import { isYearSuspect, songYear } from '../library';
import { pause, play, replay, togglePlay, usePlayer } from '../player';
import type { Library, Song } from '../types';

interface Props {
  lib: Library;
  game: Game;
  onChange: (game: Game) => void;
  onNewGame: () => void;
}

/** A ⚠ year may be a later remaster/compilation year: show it as approximate. */
const yearLabel = (s: Song) => `${isYearSuspect(s) ? '≈ ' : ''}${songYear(s) ?? '?'}`;

export function GameScreen({ lib, game, onChange, onNewGame }: Props) {
  const player = usePlayer();
  const round = game.round;
  const song = round ? lib.songs[round.songId] : null;
  const team = game.teams[game.turn];
  const isPlayingRound = !!song && player.current?.uri === song.uri;

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
    if (!confirm('End the game now? The current scores decide the winner.')) return;
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
    } else if (e.key === 'Enter' && game.setup.mode === 'guess' && round && !round.revealed) {
      e.preventDefault();
      onChange(reveal(game));
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
    const ranked = [...game.teams].sort((a, b) => b.score - a.score);
    return (
      <div className="game">
        <div className="winner">
          <div className="trophy">🏆</div>
          <h2>{game.winner >= 0 ? `${game.teams[game.winner].name} wins!` : "It's a draw!"}</h2>
          <ol className="final-scores">
            {ranked.map((t) => (
              <li key={t.name}>
                {t.name} <b>{t.score}</b>
              </li>
            ))}
          </ol>
          <p className="muted">{game.roundsPlayed} songs played</p>
          <button className="primary big" onClick={onNewGame}>
            New game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game">
      <div className="scoreboard">
        {game.teams.map((t, i) => (
          <div key={i} className={`team-score${i === game.turn ? ' current' : ''}`}>
            <span>{t.name}</span>
            <b>{t.score}</b>
          </div>
        ))}
        <div className="spacer" />
        <span className="muted">
          Song {game.roundsPlayed + 1} · {game.deck.length} left · first to {game.setup.target}
        </span>
        <button className="ghost small" onClick={finish}>
          End game
        </button>
      </div>

      {song && round && (
        <div className="stage">
          <p className="turn">
            <b>{team.name}</b>'s turn
          </p>

          {round.revealed ? (
            <RevealedCard song={song} />
          ) : (
            <div className="card hidden-card">
              <div className="mystery">?</div>
              <div className="controls">
                <button className="big ghost" disabled={!isPlayingRound} onClick={() => replay()} title="Replay (R)">
                  ⟲
                </button>
                <button
                  className="big primary"
                  onClick={() => (isPlayingRound ? togglePlay() : playSong(song))}
                  title="Play / pause (space)"
                >
                  {isPlayingRound && player.playing ? '❚❚ Pause' : '▶ Play'}
                </button>
              </div>
              {player.error && <p className="error-text">{player.error}</p>}
            </div>
          )}

          {game.setup.mode === 'guess' && !round.revealed && (
            <button className="primary big" onClick={() => onChange(reveal(game))}>
              Reveal (Enter)
            </button>
          )}

          {game.setup.mode === 'guess' && round.awarded && (
            <div className="awards">
              {(['title', 'artist', 'year'] as const).map((field) => (
                <button
                  key={field}
                  className={`award${round.awarded![field] ? ' on' : ''}`}
                  onClick={() => onChange(toggleAward(game, field))}
                >
                  {round.awarded![field] ? '✓' : '+1'} {field[0].toUpperCase() + field.slice(1)}
                </button>
              ))}
            </div>
          )}

          {game.setup.mode === 'timeline' && round.revealed && (
            <p className={`verdict ${round.correct ? 'right' : 'wrong'}`}>
              {round.correct ? '✓ Correct! The card stays.' : `✗ Wrong. It was ${yearLabel(song)}.`}
            </p>
          )}

          {round.revealed && (
            <button className="primary big" onClick={next}>
              Next song →
            </button>
          )}
        </div>
      )}

      {game.setup.mode === 'timeline' && round && (
        <Timeline
          lib={lib}
          ids={team.timeline}
          placing={!round.revealed}
          highlight={round.revealed && round.correct ? round.songId : undefined}
          onPlace={(index) => onChange(place(game, lib, index))}
        />
      )}
    </div>
  );
}

function RevealedCard({ song }: { song: Song }) {
  return (
    <div className="card revealed-card">
      {song.imageUrl && <img src={song.imageUrl} alt="" />}
      <div className="card-year" title={isYearSuspect(song) ? "Spotify's year; the original may be earlier" : undefined}>
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
  highlight?: string;
  onPlace: (index: number) => void;
}) {
  const slot = (index: number) =>
    props.placing && (
      <button key={`slot-${index}`} className="slot" onClick={() => props.onPlace(index)} title="Place the song here">
        +
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
