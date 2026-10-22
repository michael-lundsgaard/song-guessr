import { useEffect, useRef, useState } from 'react';
import {
  answer,
  compareTeams,
  endGame,
  isTurnBased,
  markPlayed,
  nextTurn,
  place,
  reveal,
  revealClosest,
  setGuess,
  toggleAward,
  type Game,
} from '../game';
import { useT } from '../i18n';
import { decadeOf, isYearSuspect, songYear } from '../library';
import { pause, play, replay, togglePlay, usePlayer } from '../player';
import type { Library, Song } from '../types';
import { PlayerBar } from './PlayerBar';

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
  const mode = game.setup.mode;
  const isPlayingRound = !!song && player.current?.uri === song.uri;

  // An answer picked but not yet confirmed: a timeline slot, a decade or an artist.
  const [pending, setPending] = useState<number | string | null>(null);
  useEffect(() => setPending(null), [round?.songId]);

  function confirmPending() {
    if (pending == null) return;
    onChange(mode === 'timeline' ? place(game, lib, pending as number) : answer(game, lib, pending));
    setPending(null);
  }

  const canReveal = mode !== 'closest' || !!round?.guesses?.some((g) => g != null);

  /** Enter / the main button before the card is shown. */
  function resolveRound() {
    if (mode === 'guess') onChange(reveal(game));
    else if (mode === 'closest') {
      if (canReveal) onChange(revealClosest(game, lib));
    } else confirmPending();
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

  // Keyboard: space = play/pause, R = replay, Enter = reveal / confirm, → = next song.
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
      resolveRound();
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
            {ranked.map((tm) => (
              <li key={tm.name}>
                {tm.name} <b>{tm.score}</b>
                {game.setup.extraPoints && <span className="muted">{t.extraSuffix(tm.bonus ?? 0)}</span>}
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

  const pickLabel = mode === 'timeline' ? t.pickSpot : t.pickAnswer;
  const confirmLabel = mode === 'timeline' ? t.confirmPlacement : t.confirmAnswer;
  const mainAction = !round ? null : round.revealed ? (
    <button className="primary big" onClick={next}>
      {t.nextSong}
    </button>
  ) : mode === 'guess' || mode === 'closest' ? (
    <button className="primary big" disabled={!canReveal} onClick={resolveRound}>
      {t.reveal}
    </button>
  ) : (
    <button className="primary big" disabled={pending == null} onClick={confirmPending}>
      {pending == null ? pickLabel : confirmLabel}
    </button>
  );

  const hint = {
    timeline: t.hintTimeline,
    guess: t.hintGuess,
    closest: t.hintClosest,
    decade: t.hintDecade,
    artist: t.hintArtist,
  }[mode];
  const songDecade = song ? decadeOf(songYear(song)) : null;

  return (
    <div className={`game mode-${mode}`}>
      <div className="scoreboard">
        {game.teams.map((tm, i) => (
          <div key={i} className={`team-score${isTurnBased(mode) && i === game.turn ? ' current' : ''}`}>
            <span>{tm.name}</span>
            <b>{tm.score}</b>
            {mode === 'timeline' && game.setup.extraPoints && (
              <span className="muted small-note" title={t.extraOnlyTie}>
                +{tm.bonus ?? 0}
              </span>
            )}
          </div>
        ))}
        <div className="spacer" />
        <span className="muted">{t.progress(game.roundsPlayed + 1, game.deck.length, game.setup.target)}</span>
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
              <b>{isTurnBased(mode) ? t.turn(team.name) : t.everyoneGuesses}</b>
            </p>
            {!round.revealed && <p className="muted hint">{hint}</p>}

            {mode === 'timeline' && round.revealed && (
              <p className={`verdict ${round.correct ? 'right' : 'wrong'}`}>
                {round.correct ? t.correct : t.wrong(yearLabel(song))}
              </p>
            )}

            {mode === 'closest' && (
              <ClosestGuesses
                game={game}
                song={song}
                onGuess={(i, year) => onChange(setGuess(game, i, year))}
                onDone={resolveRound}
              />
            )}

            {mode === 'decade' && (
              <Choices
                options={game.decadeChoices ?? []}
                label={(d) => t.decade(d as number)}
                pending={pending}
                round={round}
                answer={songDecade}
                onPick={setPending}
              />
            )}
            {mode === 'decade' && round.revealed && (
              <p className={`verdict ${round.correct ? 'right' : 'wrong'}`}>
                {round.correct ? t.correctAnswer : t.wrongDecade(t.decade(songDecade!))}
              </p>
            )}

            {mode === 'artist' && (
              <Choices
                options={round.options ?? []}
                label={(a) => String(a)}
                pending={pending}
                round={round}
                answer={song.artists[0] ?? null}
                onPick={setPending}
              />
            )}
            {mode === 'artist' && round.revealed && (
              <p className={`verdict ${round.correct ? 'right' : 'wrong'}`}>
                {round.correct ? t.correctAnswer : t.wrongArtist(song.artists[0] ?? '?')}
              </p>
            )}

            {round.awarded && (
              <div className="awards">
                {mode === 'timeline' && <span className="muted">{t.extraPointsLabel}</span>}
                {(['title', 'artist', 'year'] as const).map((field) => (
                  <button
                    key={field}
                    className={`award${round.awarded![field] ? ' on' : ''}`}
                    onClick={() => onChange(toggleAward(game, field))}
                  >
                    {round.awarded![field] ? '✓' : '+1'}{' '}
                    {field === 'title'
                      ? t.awardTitle
                      : field === 'artist'
                        ? t.awardArtist
                        : mode === 'timeline'
                          ? t.awardExactYear
                          : t.awardYear}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'timeline' && round && (
        <Timeline
          lib={lib}
          ids={team.timeline}
          placing={!round.revealed}
          selected={typeof pending === 'number' ? pending : null}
          highlight={round.revealed && round.correct ? round.songId : undefined}
          onSelect={setPending}
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

/** Closest year: a year field per team; afterwards each guess with how far off it was and the points. */
function ClosestGuesses(props: {
  game: Game;
  song: Song;
  onGuess: (team: number, year: number | null) => void;
  onDone: () => void;
}) {
  const t = useT();
  const round = props.game.round!;
  const year = songYear(props.song)!;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <div className="guesses">
      {props.game.teams.map((team, i) => {
        const guess = round.guesses?.[i] ?? null;
        const points = round.points?.[i] ?? 0;
        return (
          <label key={i} className={`guess${round.revealed && points ? ' scored' : ''}`}>
            <span className="guess-team">{team.name}</span>
            {round.revealed ? (
              <>
                <b className="guess-year">{guess ?? '–'}</b>
                <span className="muted">{guess == null ? t.noGuess : t.yearsOff(Math.abs(guess - year))}</span>
                {points > 0 && <b className="guess-points">{t.plusPoints(points)}</b>}
              </>
            ) : (
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                className="guess-input"
                inputMode="numeric"
                placeholder={t.yearPlaceholder}
                value={guess ?? ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                  props.onGuess(i, digits ? Number(digits) : null);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  // Enter moves on to the next team's field; on the last one it reveals.
                  const nextInput = inputs.current[i + 1];
                  if (nextInput) nextInput.focus();
                  else props.onDone();
                }}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

/** Big answer buttons (decades or artists). After the reveal the right answer turns green, a wrong pick red. */
function Choices(props: {
  options: (number | string)[];
  label: (option: number | string) => string;
  pending: number | string | null;
  round: NonNullable<Game['round']>;
  answer: number | string | null;
  onPick: (option: number | string) => void;
}) {
  const { round } = props;
  const stateOf = (o: number | string) => {
    if (!round.revealed) return o === props.pending ? ' selected' : '';
    if (o === props.answer) return ' right';
    return o === round.pick ? ' wrong' : '';
  };
  return (
    <div className="choices">
      {props.options.map((o) => (
        <button
          key={String(o)}
          className={`choice-button${stateOf(o)}`}
          disabled={round.revealed}
          onClick={() => props.onPick(o)}
        >
          {props.label(o)}
        </button>
      ))}
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
