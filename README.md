# Life Tracker

A personal, offline-first PWA for logging meals, sleep, waking and exercise, with game-style HP bars and a project-queue to-do list. Built mobile-first for a ~390px portrait screen, with light/dark mode and three switchable styles.

## Features

- **Log** — one-tap buttons (custom photos supported), exercise timer with type, backfilling whole sleep/exercise sessions, unpaired-event detection.
- **HP bars** — 7-day rolling sleep HP (duration + bedtime regularity on a 24-hour circle, so irregular schedules work) and exercise HP (hours per week), with a damage "ghost" effect and per-day charts.
- **To-do** — two-week calendar with due-date dots, Long term / Short term / Done queues with drag-to-reorder, projects with sub-tasks, drag a task into a project.
- **Settings** — targets, themes, button photos, JSON export/import, clear data.

## Your data

Everything is stored **only in your browser** (IndexedDB). There is no server or account. Use *Settings → 匯出 JSON* to back up. Schema changes always ship with migrations; old backup files are converted on import.

## Development

```bash
npm install
npm run dev        # dev server (add -- --host to open on your phone over LAN)
npm test           # unit tests (vitest)
npm run typecheck
npm run build      # production build + service worker into dist/
```

Stack: Vite, React, TypeScript, Tailwind CSS v4, Dexie, vite-plugin-pwa, dnd-kit, framer-motion.

## Deploy

Import the repo at [vercel.com/new](https://vercel.com/new) — Vite is detected automatically. `vercel.json` keeps the service worker and `index.html` uncached so the in-app "new version" prompt works. Installing to an iPhone home screen requires the HTTPS URL.
