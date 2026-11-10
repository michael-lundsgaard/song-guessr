import { useEffect, useState } from 'react';
import { useT } from '../i18n';

/** The last seconds are counted in the warning colour. */
const WARN_SECONDS = 10;

/**
 * The hidden card as a clock: its outline drains like a fuse from when the song starts, and the seconds left
 * sit at the top. At zero the outline turns red, with one soft flash, and the count runs on below zero (−12),
 * like a stage timer. Only a visual cue: it never stops anything, the host decides.
 */
export function CardTimer({ seconds, startedAt }: { seconds: number; startedAt: number | null }) {
  const t = useT();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (startedAt == null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [startedAt]);

  const left = startedAt == null ? seconds : seconds - Math.max(0, now - startedAt) / 1000;
  const over = left <= 0;
  const phase = startedAt == null ? 'idle' : over ? 'over' : left <= WARN_SECONDS ? 'warn' : 'run';
  const shown = over ? Math.floor(-left) : Math.ceil(left);

  return (
    <>
      <svg className={`card-timer ${phase}`} aria-hidden>
        <rect className="track" pathLength={100} />
        <rect className="fuse" pathLength={100} style={{ strokeDashoffset: over ? 100 : 100 * (1 - left / seconds) }} />
      </svg>
      <div className={`timer-count ${phase}`} role="timer" aria-label={over ? t.timeOver(shown) : t.timeLeft(shown)}>
        <span className="timer-digits">
          {/* The minus hangs to the left, so the digits stay centred. The first second over shows 0, not −0. */}
          {over && shown > 0 && <span className="timer-sign">−</span>}
          {shown}
        </span>
      </div>
    </>
  );
}
