export type EventType = 'meal' | 'sleep' | 'wake' | 'exercise_start' | 'exercise_end';

export interface LogEvent {
  id: string;
  type: EventType;
  timestamp: number;
  note?: string;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  due?: string; // YYYY-MM-DD
}

export interface Card {
  id: string;
  kind: 'project' | 'single';
  column: 'long' | 'short' | 'done';
  order: number;
  title: string;
  description?: string;
  due?: string;
  tasks: Task[];
  completedAt?: number;
  /** column a card came from before moving to Done, so un-completing can send it back */
  prevColumn?: 'long' | 'short';
  /** set on a Done card that was a project sub-task, so it can count toward / return to its project */
  fromProject?: { id: string; title: string };
}

export type Column = Card['column'];

export interface Settings {
  id: 'main';
  sleepTargetHours: number;
  sleepStdDevMinutes: number;
  /** weekly target, hours */
  exerciseTargetHours: number;
  exerciseTypes: string[];
  /** Device-local: when this device last exported a backup. Never taken from imported files. */
  lastExportedAt?: number;
  /** UI style; optional, defaults to 'clean' */
  theme?: ThemeId;
}

export type ThemeId = 'clean' | 'rpg' | 'soft';

/** The four one-tap buttons on the log page. */
export type QuickButtonId = 'meal' | 'sleep' | 'wake' | 'exercise';
export const QUICK_BUTTON_IDS: QuickButtonId[] = ['meal', 'sleep', 'wake', 'exercise'];
export const QUICK_BUTTON_META: Record<QuickButtonId, { emoji: string; label: string }> = {
  meal: { emoji: '🍚', label: '吃飯' },
  sleep: { emoji: '😴', label: '睡覺' },
  wake: { emoji: '☀️', label: '起床' },
  exercise: { emoji: '🏃', label: '運動' },
};

/** A user photo replacing a quick button's emoji (square JPEG data URL). */
export interface ButtonImage {
  id: QuickButtonId;
  dataUrl: string;
  updatedAt: number;
}

export const EVENT_TYPES: EventType[] = ['meal', 'sleep', 'wake', 'exercise_start', 'exercise_end'];

export const EVENT_META: Record<EventType, { icon: string; label: string }> = {
  meal: { icon: '🍚', label: '吃飯' },
  sleep: { icon: '😴', label: '睡覺' },
  wake: { icon: '☀️', label: '起床' },
  exercise_start: { icon: '🏃', label: '開始運動' },
  exercise_end: { icon: '🏁', label: '結束運動' },
};
