import { useRef, useState, type ReactNode } from 'react';
import Sheet from '../components/Sheet';
import ThemePicker from '../components/ThemePicker';
import ButtonIconSettings from '../components/ButtonIconSettings';
import { addExerciseType, updateSettings, useSettings } from '../db/db';
import { clearAll, exportBackup, importBackup, parseBackup, type BackupFile } from '../db/backup';
import { DAY, shortDateTime } from '../lib/time';
import { useNow } from '../lib/useNow';

const BACKUP_REMIND_DAYS = 7;

function LastExport({ at }: { at?: number }) {
  const now = useNow(60_000);
  if (!at) {
    return <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">這台裝置還沒匯出過備份</p>;
  }
  const days = Math.floor((now - at) / DAY);
  const stale = days >= BACKUP_REMIND_DAYS;
  return (
    <p
      className={`rounded-xl px-3 py-2 text-sm ${
        stale
          ? 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
          : 'bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300'
      }`}
    >
      上次匯出：{shortDateTime(at)}（{days === 0 ? '今天' : `${days} 天前`}）{stale && '，建議再備份一次'}
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-medium text-slate-500">{title}</h2>
      <div className="ui-card space-y-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">{children}</div>
    </section>
  );
}

const btn = 'w-full rounded-xl py-3 font-medium';

function NumberSetting(props: { label: string; hint?: string; unit: string; step: number; value: number; onSave: (v: number) => void }) {
  const [text, setText] = useState(String(props.value));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : String(props.value);
  const commit = () => {
    setFocused(false);
    const v = Number(text);
    if (Number.isFinite(v) && v > 0 && v !== props.value) props.onSave(v);
  };
  return (
    <label className="flex items-center gap-3">
      <span className="flex-1">
        <span className="block text-sm">{props.label}</span>
        {props.hint && <span className="block text-xs text-slate-500">{props.hint}</span>}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={props.step}
        step={props.step}
        value={shown}
        onFocus={() => {
          setText(String(props.value));
          setFocused(true);
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-20 rounded-xl bg-slate-100 px-3 py-2 text-right tabular-nums dark:bg-slate-800"
      />
      <span className="w-8 text-sm text-slate-500">{props.unit}</span>
    </label>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<(BackupFile & { fromVersion: number; skippedImages: number }) | null>(null);
  const [message, setMessage] = useState('');
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [clearText, setClearText] = useState('');
  const [newType, setNewType] = useState('');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
      setMessage('');
    } catch (e) {
      setMessage(`匯入失敗：${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    await importBackup(pending, mode);
    const converted = pending.fromVersion < pending.version ? `，已從舊格式 v${pending.fromVersion} 自動轉換` : '';
    const skipped = pending.skippedImages ? `，略過 ${pending.skippedImages} 張無法使用的照片` : '';
    setMessage(`已匯入 ${pending.events.length} 筆紀錄、${pending.cards.length} 張卡片（${mode === 'replace' ? '取代' : '合併'}${converted}${skipped}）`);
    setPending(null);
  };

  return (
    <div className="space-y-6 px-4 pt-4">
      <h1 className="text-2xl font-bold">設定</h1>

      <Section title="外觀">
        <ThemePicker value={settings.theme ?? 'clean'} />
      </Section>

      <Section title="按鈕圖示">
        <ButtonIconSettings />
      </Section>

      <Section title="運動類型">
        <div className="flex flex-wrap gap-2">
          {settings.exerciseTypes.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-slate-100 py-1.5 pr-2 pl-3 text-sm dark:bg-slate-800">
              {t}
              <button
                aria-label={`刪除 ${t}`}
                className="px-1 text-slate-400"
                onClick={() => updateSettings({ exerciseTypes: settings.exerciseTypes.filter((x) => x !== t) })}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await addExerciseType(newType);
            setNewType('');
          }}
        >
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="新增運動類型"
            className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800"
          />
          <button className="rounded-xl bg-sky-500 px-4 text-white">新增</button>
        </form>
      </Section>

      <Section title="HP 目標值">
        <NumberSetting
          label="每晚睡眠目標"
          unit="小時"
          step={0.5}
          value={settings.sleepTargetHours}
          onSave={(v) => updateSettings({ sleepTargetHours: v })}
        />
        <NumberSetting
          label="入睡時間容許標準差"
          hint="標準差達到這個值，規律分數就是 0"
          unit="分鐘"
          step={5}
          value={settings.sleepStdDevMinutes}
          onSave={(v) => updateSettings({ sleepStdDevMinutes: v })}
        />
        <NumberSetting
          label="每週運動目標"
          hint={`日均約 ${Math.round((settings.exerciseTargetHours / 7) * 60)} 分鐘`}
          unit="小時"
          step={0.5}
          value={settings.exerciseTargetHours}
          onSave={(v) => updateSettings({ exerciseTargetHours: v })}
        />
      </Section>

      <Section title="資料備份">
        <LastExport at={settings.lastExportedAt} />
        <button
          onClick={async () => {
            try {
              if (await exportBackup()) setMessage('已匯出備份');
            } catch (e) {
              setMessage(`匯出失敗：${(e as Error).message}`);
            }
          }}
          className={`${btn} bg-sky-500 text-white`}
        >
          匯出 JSON
        </button>
        <button onClick={() => fileRef.current?.click()} className={`${btn} bg-slate-100 dark:bg-slate-800`}>
          匯入 JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </Section>

      <Section title="危險區域">
        {clearStep === 0 && (
          <button onClick={() => setClearStep(1)} className={`${btn} bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300`}>
            清除所有資料
          </button>
        )}
        {clearStep === 1 && (
          <div className="space-y-2">
            <p className="text-sm">確定要清除所有紀錄、待辦與設定嗎？建議先匯出備份。</p>
            <div className="flex gap-2">
              <button onClick={() => setClearStep(0)} className={`${btn} bg-slate-100 dark:bg-slate-800`}>
                取消
              </button>
              <button onClick={() => setClearStep(2)} className={`${btn} bg-red-500 text-white`}>
                繼續
              </button>
            </div>
          </div>
        )}
        {clearStep === 2 && (
          <div className="space-y-2">
            <p className="text-sm">請輸入「刪除」確認：</p>
            <input
              value={clearText}
              onChange={(e) => setClearText(e.target.value)}
              className="w-full rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setClearStep(0);
                  setClearText('');
                }}
                className={`${btn} bg-slate-100 dark:bg-slate-800`}
              >
                取消
              </button>
              <button
                disabled={clearText !== '刪除'}
                onClick={async () => {
                  await clearAll();
                  setClearStep(0);
                  setClearText('');
                  setMessage('已清除所有資料');
                }}
                className={`${btn} bg-red-500 text-white disabled:opacity-40`}
              >
                永久清除
              </button>
            </div>
          </div>
        )}
      </Section>

      <p className="pb-4 text-center text-xs text-slate-400">
        Life Tracker 版本 {__APP_VERSION__}（建置 {shortDateTime(__BUILD_TIME__)}）
      </p>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="匯入備份">
        {pending && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              備份時間 {pending.exportedAt ? shortDateTime(pending.exportedAt) : '未知'}，內含 {pending.events.length} 筆紀錄、
              {pending.cards.length} 張卡片
              {pending.appVersion && `（App 版本 ${pending.appVersion}）`}
              {pending.fromVersion < pending.version && `。這是舊格式 v${pending.fromVersion}，會自動轉換`}。
            </p>
            <button onClick={() => void doImport('replace')} className={`${btn} bg-red-500 text-white`}>
              取代全部（先清空目前資料）
            </button>
            <button onClick={() => void doImport('merge')} className={`${btn} bg-sky-500 text-white`}>
              合併（相同 id 以備份為準）
            </button>
            <button onClick={() => setPending(null)} className={`${btn} text-slate-500`}>
              取消
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
