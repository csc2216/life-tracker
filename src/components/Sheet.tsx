import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Sheet({ open, onClose, title, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="pb-safe absolute inset-x-0 bottom-0 mx-auto max-h-[90%] max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="sticky top-0 flex items-center justify-between bg-white px-5 pt-4 pb-2 dark:bg-slate-900">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-full px-3 py-1 text-slate-500" aria-label="關閉">
                ✕
              </button>
            </div>
            <div className="px-5 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
