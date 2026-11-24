import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_INTERVAL = 60 * 60 * 1000;

export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // A home-screen PWA can stay open for days; check for new versions hourly.
      if (registration) setInterval(() => void registration.update(), CHECK_INTERVAL);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const id = setTimeout(() => setOfflineReady(false), 3000);
    return () => clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  const show = needRefresh || offlineReady;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="pt-safe fixed inset-x-0 top-0 z-50 flex justify-center px-4"
        >
          <div className="mt-2 flex w-full max-w-md items-center gap-2 rounded-2xl bg-sky-600 py-2 pr-2 pl-4 text-sm text-white shadow-lg">
            {needRefresh ? (
              <>
                <button className="flex-1 py-1 text-left font-medium" onClick={() => void updateServiceWorker(true)}>
                  ✨ 有新版本，點此更新
                </button>
                <button aria-label="稍後" className="px-2 py-1 opacity-80" onClick={() => setNeedRefresh(false)}>
                  ✕
                </button>
              </>
            ) : (
              <span className="flex-1 py-1">已可離線使用</span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
