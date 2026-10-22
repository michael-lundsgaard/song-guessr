import { useMemo, useState } from 'react';
import { eligibleSongs, forgetPlayed, loadLastSetup, loadRecent, type GameSetup as Setup, type Mode } from '../game';
import { compareCollections, decadeOf, isYearSuspect, songYear } from '../library';
import { useT } from '../i18n';
import type { Library } from '../types';
import { RulesList } from './Rules';

const MODES: { mode: Mode; defaultTarget: number }[] = [
  { mode: 'timeline', defaultTarget: 10 },
  { mode: 'guess', defaultTarget: 15 },
  { mode: 'closest', defaultTarget: 10 },
  { mode: 'decade', defaultTarget: 10 },
  { mode: 'artist', defaultTarget: 10 },
];

export function GameSetup({ lib, onStart }: { lib: Library; onStart: (setup: Setup) => void }) {
  const t = useT();
  const collections = Object.values(lib.collections).sort(compareCollections);
  const [setup, setSetup] = useState<Setup>(() => {
    const last = loadLastSetup();
    return {
      mode: last?.mode ?? 'timeline',
      collectionIds: (last?.collectionIds ?? []).filter((id) => lib.collections[id]),
      decades: last?.decades ?? [],
      teams: last?.teams ?? [t.teamName(1), t.teamName(2)],
      target: last?.target ?? 10,
      // Not remembered: a harder game is a one-off choice.
      randomStart: false,
      extraPoints: last?.extraPoints ?? false,
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
  const [recent, setRecent] = useState(loadRecent);
  const played = useMemo(() => {
    const ids = new Set(recent);
    return songs.filter((s) => ids.has(s.id)).length;
  }, [songs, recent]);
  const teams = setup.teams.map((t) => t.trim()).filter(Boolean);
  const enough = songs.length >= teams.length * 2;

  return (
    <div className="game-setup">
      <h2>{t.newGame}</h2>

      <section>
        <h3>{t.gameHeading}</h3>
        <div className="mode-picker">
          {MODES.map((m) => (
            <button
              key={m.mode}
              className={`mode${setup.mode === m.mode ? ' active' : ''}`}
              onClick={() => patch({ mode: m.mode, target: m.defaultTarget })}
            >
              <b>{t.modeNames[m.mode]}</b>
              <span className="muted">{t.modeHelp[m.mode]}</span>
            </button>
          ))}
        </div>
        <details className="rules" open>
          <summary>{t.rulesTitle(t.modeNames[setup.mode])}</summary>
          <RulesList mode={setup.mode} />
        </details>
      </section>

      <section>
        <h3>{t.songsFrom}</h3>
        {collections.length === 0 && <p className="muted">{t.makeCollectionFirst}</p>}
        <div className="choice-list">
          {collections.map((c) => (
            <label key={c.id} className="inline choice">
              <input
                type="checkbox"
                checked={setup.collectionIds.includes(c.id)}
                onChange={() => patch({ collectionIds: toggle(setup.collectionIds, c.id) })}
              />
              {c.source?.kind === 'liked' ? '♥ ' : c.source ? '♫ ' : ''}
              {c.name} <span className="muted">{collectionCounts[c.id] ?? 0}</span>
            </label>
          ))}
        </div>
        {decadeCounts.length > 1 && (
          <div className="decades" title={t.decadeFilterTitle}>
            {decadeCounts.map(([d, n]) => (
              <button
                key={d}
                className={`decade${setup.decades.includes(d) ? ' active' : ''}`}
                onClick={() => patch({ decades: toggle(setup.decades, d) })}
              >
                <span>{t.decadeShort(d)}</span>
                <b>{n}</b>
              </button>
            ))}
          </div>
        )}
        <p className="muted">
          {t.deckCount(songs.length)}
          {uncertain > 0 && t.uncertainCount(uncertain)}
        </p>
        {played > 0 && (
          <p className="muted">
            {t.playedNote(played, songs.length - played)}{' '}
            <button
              className="link"
              onClick={() => {
                if (!confirm(t.confirmForgetPlayed)) return;
                forgetPlayed();
                setRecent([]);
              }}
            >
              {t.forgetPlayed}
            </button>
          </p>
        )}
      </section>

      <section>
        <h3>{t.teamsHeading}</h3>
        <div className="choice-list">
          {setup.teams.map((name, i) => (
            <span key={i} className="team-input">
              <input
                value={name}
                onChange={(e) => patch({ teams: setup.teams.map((t, j) => (j === i ? e.target.value : t)) })}
                placeholder={t.teamName(i + 1)}
              />
              {setup.teams.length > 1 && (
                <button
                  className="mini"
                  title={t.removeTeam}
                  onClick={() => patch({ teams: setup.teams.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <button
            className="ghost small"
            onClick={() => patch({ teams: [...setup.teams, t.teamName(setup.teams.length + 1)] })}
          >
            {t.addTeam}
          </button>
        </div>
      </section>

      <section>
        <h3>{t.optionsHeading}</h3>
        <label className="inline">
          {t.modeTarget[setup.mode]}
          <input
            type="number"
            min={1}
            max={99}
            value={setup.target}
            onChange={(e) => patch({ target: Math.max(1, Number(e.target.value) || 1) })}
            className="narrow"
          />
        </label>
        <label className="inline" title={t.randomStartTitle}>
          <input
            type="checkbox"
            checked={setup.randomStart}
            onChange={(e) => patch({ randomStart: e.target.checked })}
          />
          {t.randomStart}
        </label>
        {setup.mode === 'timeline' && (
          <label className="inline" title={t.extraPointsTitle}>
            <input
              type="checkbox"
              checked={!!setup.extraPoints}
              onChange={(e) => patch({ extraPoints: e.target.checked })}
            />
            {t.extraPoints}
          </label>
        )}
      </section>

      <section className="start-row">
        <button
          className="primary big"
          disabled={!teams.length || !enough}
          title={enough ? undefined : t.needMoreSongs}
          onClick={() => onStart({ ...setup, teams })}
        >
          {t.startGame}
        </button>
      </section>
    </div>
  );
}
