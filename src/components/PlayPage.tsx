import { useEffect, useState } from 'react';
import { loadGame, loadRecent, markPlayed, newGame, saveGame, saveLastSetup, type Game } from '../game';
import { play } from '../player';
import type { Library } from '../types';
import { GameScreen } from './GameScreen';
import { GameSetup } from './GameSetup';
import { PlayerBar } from './PlayerBar';

/** Game setup, or the game in progress (kept in this browser, so a reload resumes it). */
export function PlayPage({ lib, connected }: { lib: Library; connected: boolean }) {
  const [game, setGame] = useState<Game | null>(() => loadGame(lib));
  useEffect(() => saveGame(game), [game]);

  return (
    <main className="main play-main">
      {!connected && <p className="error-text">Connect Spotify (top right) to play.</p>}
      {game ? (
        <GameScreen lib={lib} game={game} onChange={setGame} onNewGame={() => setGame(null)} />
      ) : (
        <GameSetup
          lib={lib}
          onStart={(setup) => {
            saveLastSetup(setup);
            const started = newGame(lib, setup, loadRecent());
            setGame(started);
            // Start the first song while still inside the click, which browsers require for audio.
            const first = started.round && lib.songs[started.round.songId];
            if (first) {
              void play(first, { randomStart: setup.randomStart });
              markPlayed(first.id);
            }
          }}
        />
      )}
      {/* No titleFor: the game screen must not name the song. */}
      <PlayerBar connected={connected} />
    </main>
  );
}
