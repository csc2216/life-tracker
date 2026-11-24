import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db } from '../db/db';
import { QUICK_BUTTON_IDS, QUICK_BUTTON_META, type QuickButtonId } from '../db/types';
import { photoToIcon } from '../lib/image';

/** Pick a photo (library or camera) for each quick-log button, or revert to the emoji. */
export default function ButtonIconSettings() {
  const images = useLiveQuery(() => db.images.toArray(), []) ?? [];
  const byId = new Map(images.map((i) => [i.id, i.dataUrl]));
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<QuickButtonId | null>(null);
  const [busy, setBusy] = useState<QuickButtonId | null>(null);
  const [error, setError] = useState('');

  const pick = (id: QuickButtonId) => {
    setTarget(id);
    setError('');
    input.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file || !target) return;
    setBusy(target);
    try {
      const dataUrl = await photoToIcon(file);
      await db.images.put({ id: target, dataUrl, updatedAt: Date.now() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {QUICK_BUTTON_IDS.map((id) => {
          const url = byId.get(id);
          const meta = QUICK_BUTTON_META[id];
          return (
            <div key={id} className="flex flex-col items-center gap-1">
              <button
                onClick={() => pick(id)}
                aria-label={`更換${meta.label}的圖示`}
                className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl">{meta.emoji}</span>}
                {busy === id && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">處理中</span>}
              </button>
              <span className="text-sm">{meta.label}</span>
              {url ? (
                <button onClick={() => void db.images.delete(id)} className="text-xs text-slate-500 underline">
                  還原
                </button>
              ) : (
                <span className="text-xs text-slate-400">點圖換照片</span>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">照片會在手機上裁成正方形並縮小後儲存，不會上傳。</p>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
    </div>
  );
}
