import { useEffect, useState } from 'react';
import { loadGame, loadRecent, markPlayed, newGame, saveGame, saveLastSetup, type Game, type GameSetup as Setup } from '../game';
import { useT } from '../i18n';
import { play } from '../player';
import type { Library } from '../types';
import { GameScreen } from './GameScreen';
import { GameSetup } from './GameSetup';

/** Game setup, or the game in progress (kept in this browser, so a reload resumes it). */
export function PlayPage({ lib, connected }: { lib: Library; connected: boolean }) {
  const t = useT();
  const [game, setGame] = useState<Game | null>(() => loadGame(lib));
  useEffect(() => saveGame(game), [game]);

  /** Call from a click: the first song starts right away, which browsers only allow inside a user gesture. */
  function start(setup: Setup) {
    saveLastSetup(setup);
    const started = newGame(lib, setup, loadRecent());
    setGame(started);
    // The face-up starting cards are seen too.
    started.teams.forEach((team) => team.timeline.forEach(markPlayed));
    const first = started.round && lib.songs[started.round.songId];
    if (first) {
      void play(first, { randomStart: setup.randomStart, secret: true });
      markPlayed(first.id);
    }
  }

  return (
    <main className="main play-main">
      {!connected && <p className="error-text">{t.connectToPlay}</p>}
      {game ? (
        <GameScreen
          lib={lib}
          connected={connected}
          game={game}
          onChange={setGame}
          onPlayAgain={() => start(game.setup)}
          onNewGame={() => setGame(null)}
        />
      ) : (
        <GameSetup lib={lib} onStart={start} />
      )}
    </main>
  );
}
