import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

export interface ToastState {
  key: number;
  message: string;
  onUndo?: () => void;
}

export default function Toast({ toast, onDone }: { toast: ToastState | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDone, 4000);
    return () => clearTimeout(id);
  }, [toast, onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="pointer-events-auto flex items-center gap-4 rounded-full bg-slate-900 px-5 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
          >
            <span>{toast.message}</span>
            {toast.onUndo && (
              <button
                className="font-semibold text-sky-400 dark:text-sky-600"
                onClick={() => {
                  toast.onUndo?.();
                  onDone();
                }}
              >
                復原
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
