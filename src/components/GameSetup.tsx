import { useMemo, useState } from 'react';
import { eligibleSongs, loadLastSetup, type GameSetup as Setup, type Mode } from '../game';
import { decadeOf, isYearSuspect, songYear } from '../library';
import type { Library } from '../types';

const MODES: { mode: Mode; name: string; help: string; target: string; defaultTarget: number }[] = [
  {
    mode: 'timeline',
    name: 'Timeline',
    help: 'Hitster rules: place each song before, between or after the cards on your timeline. A correct card stays.',
    target: 'Cards to win',
    defaultTarget: 10,
  },
  {
    mode: 'guess',
    name: 'Guess the song',
    help: 'Name the title, artist and year. One point for each.',
    target: 'Points to win',
    defaultTarget: 15,
  },
];

export function GameSetup({ lib, onStart }: { lib: Library; onStart: (setup: Setup) => void }) {
  const collections = Object.values(lib.collections).sort((a, b) => a.name.localeCompare(b.name));
  const [setup, setSetup] = useState<Setup>(() => {
    const last = loadLastSetup();
    return {
      mode: last?.mode ?? 'timeline',
      collectionIds: (last?.collectionIds ?? []).filter((id) => lib.collections[id]),
      decades: last?.decades ?? [],
      teams: last?.teams ?? ['Team 1', 'Team 2'],
      target: last?.target ?? 10,
      randomStart: last?.randomStart ?? false,
    };
  });
  const patch = (p: Partial<Setup>) => setSetup((s) => ({ ...s, ...p }));
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of Object.values(lib.songs)) for (const c of s.collectionIds) counts[c] = (counts[c] ?? 0) + 1;
    return counts;
  }, [lib.songs]);

  // Decades available in the chosen collections, before the decade filter.
  const decadeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of eligibleSongs(lib, { collectionIds: setup.collectionIds, decades: [] })) {
      const d = decadeOf(songYear(s))!;
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [lib, setup.collectionIds]);

  const songs = useMemo(() => eligibleSongs(lib, setup), [lib, setup]);
  const uncertain = songs.filter(isYearSuspect).length;
  const teams = setup.teams.map((t) => t.trim()).filter(Boolean);
  const mode = MODES.find((m) => m.mode === setup.mode)!;
  const enough = songs.length >= teams.length * 2;

  return (
    <div className="game-setup">
      <h2>New game</h2>

      <section>
        <h3>Game</h3>
        <div className="mode-picker">
          {MODES.map((m) => (
            <button
              key={m.mode}
              className={`mode${setup.mode === m.mode ? ' active' : ''}`}
              onClick={() => patch({ mode: m.mode, target: m.defaultTarget })}
            >
              <b>{m.name}</b>
              <span className="muted">{m.help}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Songs from</h3>
        {collections.length === 0 && <p className="muted">Make a collection in the library first.</p>}
        <div className="choice-list">
          {collections.map((c) => (
            <label key={c.id} className="inline choice">
              <input
                type="checkbox"
                checked={setup.collectionIds.includes(c.id)}
                onChange={() => patch({ collectionIds: toggle(setup.collectionIds, c.id) })}
              />
              {c.name} <span className="muted">{collectionCounts[c.id] ?? 0}</span>
            </label>
          ))}
        </div>
        {decadeCounts.length > 1 && (
          <div className="decades" title="Leave all off to play every decade">
            {decadeCounts.map(([d, n]) => (
              <button
                key={d}
                className={`decade${setup.decades.includes(d) ? ' active' : ''}`}
                onClick={() => patch({ decades: toggle(setup.decades, d) })}
              >
                <span>{String(d).slice(2)}s</span>
                <b>{n}</b>
              </button>
            ))}
          </div>
        )}
        <p className="muted">
          {songs.length} songs in the deck
          {uncertain > 0 && ` · ${uncertain} with an uncertain year (shown as ≈ and judged leniently)`}
        </p>
      </section>

      <section>
        <h3>Teams</h3>
        <div className="choice-list">
          {setup.teams.map((name, i) => (
            <span key={i} className="team-input">
              <input
                value={name}
                onChange={(e) => patch({ teams: setup.teams.map((t, j) => (j === i ? e.target.value : t)) })}
                placeholder={`Team ${i + 1}`}
              />
              {setup.teams.length > 1 && (
                <button
                  className="mini"
                  title="Remove"
                  onClick={() => patch({ teams: setup.teams.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <button
            className="ghost small"
            onClick={() => patch({ teams: [...setup.teams, `Team ${setup.teams.length + 1}`] })}
          >
            + Team
          </button>
        </div>
      </section>

      <section className="setup-row">
        <label className="inline">
          {mode.target}
          <input
            type="number"
            min={1}
            max={99}
            value={setup.target}
            onChange={(e) => patch({ target: Math.max(1, Number(e.target.value) || 1) })}
            className="narrow"
          />
        </label>
        <label className="inline" title="Start each song somewhere in the middle instead of at the beginning">
          <input type="checkbox" checked={setup.randomStart} onChange={(e) => patch({ randomStart: e.target.checked })} />
          Harder: random start
        </label>
        <div className="spacer" />
        <button
          className="primary big"
          disabled={!teams.length || !enough}
          title={enough ? undefined : 'Pick collections with more songs'}
          onClick={() => onStart({ ...setup, teams })}
        >
          Start game
        </button>
      </section>
    </div>
  );
}
