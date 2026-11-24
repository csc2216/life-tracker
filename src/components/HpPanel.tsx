import { useMemo, useState } from 'react';
import { useSettings } from '../db/db';
import { computeExerciseHp, computeSleepHp, dailyExercise, dailySleep, formatHours, formatOnset, hpLevel, type HpLevel } from '../lib/hp';
import type { PairingResult } from '../lib/pairing';
import { formatDuration, MINUTE } from '../lib/time';
import DayBars from './DayBars';
import HpBar from './HpBar';

const fmtMin = (m: number) => formatDuration(m * MINUTE);
const pct = (v: number) => `${Math.round(v * 100)}%`;

const DOT: Record<HpLevel, string> = { good: 'bg-emerald-500', warn: 'bg-amber-400', bad: 'bg-red-500' };

function Row({ k, sub, v, level }: { k: string; sub?: string; v: string; level?: HpLevel }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-500">
        {k}
        {sub && <span className="block text-xs text-slate-400">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
        {level && <span className={`h-2 w-2 rounded-full ${DOT[level]}`} aria-hidden />}
        {v}
      </span>
    </div>
  );
}

export default function HpPanel({ pairing, now }: { pairing: PairingResult; now: number }) {
  const s = useSettings();
  const [open, setOpen] = useState<'sleep' | 'exercise' | null>(null);

  const sleep = useMemo(() => computeSleepHp(pairing.segments, now, s), [pairing, now, s]);
  const exercise = useMemo(
    () => computeExerciseHp(pairing.segments, pairing.ongoingExercise, now, s),
    [pairing, now, s],
  );

  const sleepSummary =
    sleep.days === 0
      ? '過去 7 天沒有睡眠紀錄'
      : `平均 ${sleep.avgHours.toFixed(1)}h · 入睡 ${sleep.sdMinutes === undefined ? '資料不足' : `±${Math.round(sleep.sdMinutes)} 分`}`;
  const toggle = (k: 'sleep' | 'exercise') => setOpen((o) => (o === k ? null : k));

  return (
    <div className="space-y-3">
      <HpBar icon="😴" label="睡眠" value={sleep.hp} summary={sleepSummary} expanded={open === 'sleep'} onToggle={() => toggle('sleep')}>
        <DayBars
          data={dailySleep(pairing.segments, now)}
          target={s.sleepTargetHours * 60}
          targetLabel={`目標 ${s.sleepTargetHours}h`}
          format={fmtMin}
          barClass="bg-indigo-500 dark:bg-indigo-400"
          now={now}
        />
        <div className="mt-4 space-y-1">
          <Row k="有紀錄的天數" v={`${sleep.days} / 7`} />
          <Row k="時數分數 ×0.7" sub="sigmoid(0.6 × (平均 − 5.8))" v={pct(sleep.durationScore)} level={sleep.days ? hpLevel(sleep.durationScore) : undefined} />
          <Row k="主睡眠平均入睡" v={sleep.avgOnset === undefined ? '—' : formatOnset(sleep.avgOnset)} />
          <Row
            k="規律分數 ×0.3"
            sub={`1 − 標準差 ÷ ${s.sleepStdDevMinutes} 分`}
            v={sleep.regularity === undefined ? '需 2 天以上' : `±${Math.round(sleep.sdMinutes!)} 分 → ${pct(sleep.regularity)}`}
          />
        </div>
      </HpBar>

      <HpBar
        icon="🏃"
        label="運動"
        value={exercise.hp}
        summary={`7 天 ${formatHours(exercise.minutes)} / ${s.exerciseTargetHours} 小時`}
        expanded={open === 'exercise'}
        onToggle={() => toggle('exercise')}
      >
        <DayBars
          data={dailyExercise(pairing.segments, pairing.ongoingExercise, now)}
          target={(s.exerciseTargetHours * 60) / 7}
          targetLabel={`日均 ${fmtMin((s.exerciseTargetHours * 60) / 7)}`}
          format={fmtMin}
          barClass="bg-emerald-500 dark:bg-emerald-400"
          now={now}
        />
        <div className="mt-4 space-y-1">
          <Row k="7 天總計" v={fmtMin(exercise.minutes)} />
          <Row k="還差" v={fmtMin(Math.max(0, s.exerciseTargetHours * 60 - exercise.minutes))} />
        </div>
      </HpBar>
    </div>
  );
}
