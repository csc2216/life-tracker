import { useMemo, useState } from 'react';
import { useSettings } from '../db/db';
import { computeExerciseHp, computeSleepHp, dailyExercise, dailySleep, formatHours, formatOnset } from '../lib/hp';
import type { PairingResult } from '../lib/pairing';
import { formatDuration, MINUTE } from '../lib/time';
import DayBars from './DayBars';
import HpBar from './HpBar';

const fmtMin = (m: number) => formatDuration(m * MINUTE);
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="tabular-nums">{v}</span>
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
      : `平均 ${sleep.avgHours.toFixed(1)}h · 規律 ${sleep.regularity === undefined ? '資料不足' : pct(sleep.regularity)}`;
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
          <Row k={`時數分數（平均 ÷ ${s.sleepTargetHours}h）`} v={pct(sleep.durationScore)} />
          <Row k="主睡眠平均入睡" v={sleep.avgOnset === undefined ? '—' : formatOnset(sleep.avgOnset)} />
          <Row
            k={`規律分數（標準差 ÷ ${s.sleepStdDevMinutes} 分）`}
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
