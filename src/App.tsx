import { useEffect, useState } from 'react';
import UpdateBanner from './components/UpdateBanner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, dbStatus } from './db/db';
import { useApplyTheme } from './lib/theme';
import LogPage from './pages/LogPage';
import SettingsPage from './pages/SettingsPage';
import TodoPage from './pages/TodoPage';

type Tab = 'log' | 'todo' | 'settings';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'log', icon: '📝', label: '紀錄' },
  { id: 'todo', icon: '✅', label: '待辦' },
  { id: 'settings', icon: '⚙️', label: '設定' },
];

function FatalScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="pt-safe flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-4xl">⚠️</p>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-slate-500">{detail}</p>
      <button onClick={() => location.reload()} className="rounded-xl bg-sky-500 px-6 py-3 font-medium text-white">
        重新整理
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('log');
  const [dbError, setDbError] = useState<Error | null>(null);
  const [blocked, setBlocked] = useState(dbStatus.blockedByNewerVersion);
  // null while loading (keep the theme index.html applied), undefined if never saved
  const stored = useLiveQuery(() => db.settings.get('main'), [], null);
  useApplyTheme(stored === null ? null : (stored?.theme ?? 'clean'));

  useEffect(() => {
    // Open explicitly so failures (e.g. an older app opening newer data) show
    // a message instead of silently broken pages. We never delete on failure.
    db.open().catch((e: Error) => setDbError(e));
    const l = () => setBlocked(true);
    dbStatus.listeners.add(l);
    return () => void dbStatus.listeners.delete(l);
  }, []);

  if (blocked) {
    return <FatalScreen title="App 已在別處更新" detail="另一個分頁升級了資料格式，請重新整理以使用新版本。你的資料不受影響。" />;
  }
  if (dbError) {
    const newer = dbError.name === 'VersionError';
    return (
      <>
        <UpdateBanner />
        <FatalScreen
          title={newer ? '資料來自較新的版本' : '無法開啟資料庫'}
          detail={
            newer
              ? '這台裝置上的資料是由較新版的 App 建立的。請重新整理或等待更新完成，資料不會被刪除。'
              : `${dbError.name}: ${dbError.message}。資料沒有被刪除，請重新整理再試一次。`
          }
        />
      </>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <UpdateBanner />
      <main className="pt-safe flex-1 overflow-y-auto pb-24">
        {tab === 'log' && <LogPage />}
        {tab === 'todo' && <TodoPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                tab === t.id ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
