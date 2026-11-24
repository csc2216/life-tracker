import { useEffect } from 'react';
import type { ThemeId } from '../db/types';

export const THEMES: { id: ThemeId; name: string; blurb: string }[] = [
  { id: 'clean', name: '清爽', blurb: '中性灰白、天藍主色' },
  { id: 'rpg', name: '冒險', blurb: '羊皮紙／地城、硬邊框、分格 HP' },
  { id: 'soft', name: '柔和', blurb: '粉彩漸層、毛玻璃、大圓角' },
];

/** Put the theme on <html>, remember it for the next cold start, and sync the status-bar colour. */
export function useApplyTheme(theme: ThemeId | null) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    try {
      localStorage.setItem('lt-theme', theme);
    } catch {
      /* private mode */
    }
    const sync = () => {
      const meta = document.querySelector('meta[name="theme-color"]');
      const bg = getComputedStyle(document.body).backgroundColor;
      if (meta && bg) meta.setAttribute('content', bg);
    };
    sync();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [theme]);
}
