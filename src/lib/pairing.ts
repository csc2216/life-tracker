import type { LogEvent } from '../db/types';
import { DAY } from './time';

export interface Segment {
  kind: 'sleep' | 'exercise';
  startId: string;
  endId?: string;
  start: number;
  /** undefined = still in progress */
  end?: number;
  note?: string;
}

export interface PairingResult {
  segments: Segment[];
  unpairedIds: Set<string>;
  /** maps both start and end event ids to their segment */
  segmentByEventId: Map<string, Segment>;
  ongoingExercise?: Segment;
  ongoingSleep?: Segment;
}

/** A trailing sleep with no wake counts as "sleeping now" only if this recent. */
const ONGOING_SLEEP_LIMIT = DAY;

function pairKind(
  sorted: LogEvent[],
  kind: Segment['kind'],
  startType: LogEvent['type'],
  endType: LogEvent['type'],
  out: PairingResult,
  now: number,
): Segment | undefined {
  let pending: LogEvent | undefined;
  for (const ev of sorted) {
    if (ev.type === startType) {
      if (pending) out.unpairedIds.add(pending.id); // two starts in a row
      pending = ev;
    } else if (ev.type === endType) {
      if (!pending) {
        out.unpairedIds.add(ev.id); // end without start
        continue;
      }
      const seg: Segment = {
        kind,
        startId: pending.id,
        endId: ev.id,
        start: pending.timestamp,
        end: ev.timestamp,
        note: pending.note,
      };
      out.segments.push(seg);
      out.segmentByEventId.set(seg.startId, seg);
      out.segmentByEventId.set(ev.id, seg);
      pending = undefined;
    }
  }
  if (!pending) return undefined;
  const isOngoing = kind === 'exercise' || now - pending.timestamp < ONGOING_SLEEP_LIMIT;
  if (!isOngoing) {
    out.unpairedIds.add(pending.id);
    return undefined;
  }
  const seg: Segment = { kind, startId: pending.id, start: pending.timestamp, note: pending.note };
  out.segmentByEventId.set(seg.startId, seg);
  return seg;
}

export function pairEvents(events: LogEvent[], now = Date.now()): PairingResult {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const out: PairingResult = {
    segments: [],
    unpairedIds: new Set(),
    segmentByEventId: new Map(),
  };
  out.ongoingSleep = pairKind(sorted, 'sleep', 'sleep', 'wake', out, now);
  out.ongoingExercise = pairKind(sorted, 'exercise', 'exercise_start', 'exercise_end', out, now);
  out.segments.sort((a, b) => a.start - b.start);
  return out;
}
