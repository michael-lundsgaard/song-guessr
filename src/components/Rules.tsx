import { useEffect, useRef } from 'react';
import type { Mode } from '../game';
import { useT } from '../i18n';

/** The rules of one game mode as a list, plus the keyboard keys. */
export function RulesList({ mode, randomStart, timer }: { mode: Mode; randomStart?: boolean; timer?: number }) {
  const t = useT();
  return (
    <>
      <ul className="rules-list">
        {t.rules[mode].map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
        {randomStart && <li>{t.rulesRandomStart}</li>}
        {!!timer && <li>{t.rulesTimer(timer)}</li>}
      </ul>
      <p className="muted rules-keys">{t.rulesKeys}</p>
    </>
  );
}

/** The rules in a dialog, for reading them during a game. */
export function RulesDialog(props: { mode: Mode; randomStart: boolean; timer?: number; onClose: () => void }) {
  const { mode, randomStart, timer, onClose } = props;
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog ref={ref} className="dialog" onClose={onClose}>
      <h2>{t.rulesTitle(t.modeNames[mode])}</h2>
      <RulesList mode={mode} randomStart={randomStart} timer={timer} />
      <div className="dialog-actions">
        <button className="primary" onClick={() => ref.current?.close()} autoFocus>
          {t.close}
        </button>
      </div>
    </dialog>
  );
}
