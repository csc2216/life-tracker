import { updateSettings } from '../db/db';
import type { ThemeId } from '../db/types';
import { THEMES } from '../lib/theme';

/** Each preview carries its own data-theme, so the CSS variables render it live. */
function Preview({ id }: { id: ThemeId }) {
  return (
    <div data-theme={id} className="ui-page rounded-xl bg-slate-100 p-2 dark:bg-slate-950">
      <div className="ui-card space-y-1.5 rounded-2xl bg-white p-2 shadow-sm dark:bg-slate-900">
        <div className="ui-hp relative h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="absolute inset-y-0 left-0 w-3/4 rounded-full bg-emerald-500" />
        </div>
        <div className="h-1.5 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="rounded-xl bg-sky-500 py-1 text-center text-[10px] text-white">按鈕</div>
      </div>
    </div>
  );
}

export default function ThemePicker({ value }: { value: ThemeId }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => void updateSettings({ theme: t.id })}
          aria-pressed={value === t.id}
          className={`rounded-2xl p-1.5 text-left ring-2 transition ${value === t.id ? 'ring-sky-500' : 'ring-transparent'}`}
        >
          <Preview id={t.id} />
          <span className="mt-1.5 block px-1 text-sm font-medium">{t.name}</span>
          <span className="block px-1 text-[11px] leading-tight text-slate-500">{t.blurb}</span>
        </button>
      ))}
    </div>
  );
}
