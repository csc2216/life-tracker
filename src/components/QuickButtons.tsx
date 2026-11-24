import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { QUICK_BUTTON_META, type QuickButtonId } from '../db/types';
import type { Segment } from '../lib/pairing';
import { formatElapsed } from '../lib/time';
import { useNow } from '../lib/useNow';

interface Props {
  ongoingExercise?: Segment;
  onLog: (type: 'meal' | 'sleep' | 'wake') => void;
  onExercise: () => void;
  onEditExerciseType: () => void;
}

const base =
  'ui-tile flex h-28 flex-col items-center justify-center gap-1 rounded-3xl text-lg font-semibold shadow-sm active:shadow-none';

export default function QuickButtons({ ongoingExercise, onLog, onExercise, onEditExerciseType }: Props) {
  const now = useNow(1000, !!ongoingExercise);
  const images = useLiveQuery(() => db.images.toArray(), []);
  const photos = new Map((images ?? []).map((i) => [i.id, i.dataUrl]));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Btn className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100" onClick={() => onLog('meal')}>
          <Icon id="meal" photos={photos} />吃飯
        </Btn>
        <Btn className="bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100" onClick={() => onLog('sleep')}>
          <Icon id="sleep" photos={photos} />睡覺
        </Btn>
        <Btn className="bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100" onClick={() => onLog('wake')}>
          <Icon id="wake" photos={photos} />起床
        </Btn>
        {ongoingExercise ? (
          <Btn className="bg-emerald-500 text-white ring-4 ring-emerald-300 dark:ring-emerald-700" onClick={onExercise}>
            <span className="font-mono text-2xl tabular-nums">{formatElapsed(now - ongoingExercise.start)}</span>
            <span className="text-base">點此結束運動</span>
          </Btn>
        ) : (
          <Btn className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" onClick={onExercise}>
            <Icon id="exercise" photos={photos} />運動
          </Btn>
        )}
      </div>
      {ongoingExercise && (
        <button
          onClick={onEditExerciseType}
          className="mt-2 w-full rounded-2xl bg-emerald-50 px-4 py-2 text-left text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          🏃 進行中 · {ongoingExercise.note ?? '未選類型'} <span className="float-right text-emerald-600">改類型 ›</span>
        </button>
      )}
    </div>
  );
}

/** The user's photo for this button if set, otherwise the emoji. */
function Icon({ id, photos }: { id: QuickButtonId; photos: Map<string, string> }) {
  const url = photos.get(id);
  if (url) return <img src={url} alt="" draggable={false} className="h-16 w-16 rounded-xl object-cover shadow-sm" />;
  return <span className="text-4xl">{QUICK_BUTTON_META[id].emoji}</span>;
}

function Btn({ className, onClick, children }: { className: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick} className={`${base} ${className}`}>
      {children}
    </motion.button>
  );
}
