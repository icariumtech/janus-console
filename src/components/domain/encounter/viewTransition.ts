/**
 * viewTransition — pure decisions for GM view changes on the encounter map.
 *
 * Rules (sources):
 *  - D-08: a rotation-offset-only change fades; projection and location changes cut.
 *  - D-13: pan/zoom resets exactly once, at the `snap` step; fades never reset.
 *  - D-18: a pending or active drag is cancelled when the view changes under it.
 *  - UI-SPEC reduced-motion row: prefers-reduced-motion turns the fade into a cut.
 *
 * Deliberately free of GSAP and React so vitest covers it without a DOM. It is
 * unrelated to src/hooks/useViewTransition.ts (app-level view-type glitch
 * transitions).
 */
import type { ViewOrientation } from './geometry/viewOrientation';

export interface ViewSnapshot extends ViewOrientation {
  locationKey?: string;
}

export type ViewChange = 'none' | 'cut' | 'fade';

export const FADE_OUT_SECONDS = 0.2;
export const FADE_IN_SECONDS = 0.2;
export const FADE_OUT_EASE = 'power1.in';
export const FADE_IN_EASE = 'power1.out';

/**
 * Classify the change between two requested snapshots.
 * none: same projection and offset (a location change alone is not a view change).
 * cut: projection or location differs (also when the offset differs too).
 * fade: offset-only change (cut when reduced motion is requested).
 */
export function classifyChange(prev: ViewSnapshot, next: ViewSnapshot, reducedMotion = false): ViewChange {
  if (prev.projection === next.projection && prev.rotationOffset === next.rotationOffset) {
    return 'none';
  }
  if (prev.projection !== next.projection || prev.locationKey !== next.locationKey) {
    return 'cut';
  }
  return reducedMotion ? 'cut' : 'fade';
}

export type TransitionStep =
  | { op: 'fadeOut'; seconds: number; ease: string }
  | { op: 'snap' }
  | { op: 'fadeIn'; seconds: number; ease: string };

export interface TransitionPlan {
  change: ViewChange | 'restore';
  steps: TransitionStep[];
}

/**
 * Order the steps for a change. A `snap` step means: apply the LATEST requested
 * orientation (read through `orientationOf` at snap time, never the value
 * captured when the plan was made) and reset pan/zoom exactly once (D-13).
 * Fades never reset.
 *
 * `displayed` is the orientation currently on screen. If a fade is requested
 * but `displayed` already equals `next` (the user rotated back before the
 * snap), only a fade-in remains: change 'restore', no snap, no reset.
 */
export function planTransition(
  prev: ViewSnapshot,
  next: ViewSnapshot,
  displayed: ViewOrientation,
  reducedMotion = false,
): TransitionPlan {
  const change = classifyChange(prev, next, reducedMotion);
  if (change === 'none') return { change, steps: [] };
  if (change === 'cut') return { change, steps: [{ op: 'snap' }] };
  if (displayed.projection === next.projection && displayed.rotationOffset === next.rotationOffset) {
    return {
      change: 'restore',
      steps: [{ op: 'fadeIn', seconds: FADE_IN_SECONDS, ease: FADE_IN_EASE }],
    };
  }
  return {
    change,
    steps: [
      { op: 'fadeOut', seconds: FADE_OUT_SECONDS, ease: FADE_OUT_EASE },
      { op: 'snap' },
      { op: 'fadeIn', seconds: FADE_IN_SECONDS, ease: FADE_IN_EASE },
    ],
  };
}

/** The orientation of a snapshot, dropping locationKey. */
export function orientationOf(s: ViewSnapshot): ViewOrientation {
  return { projection: s.projection, rotationOffset: s.rotationOffset };
}

/** Stable key that changes with projection, offset or location. */
export function buildViewKey(s: ViewSnapshot): string {
  return `${s.projection}:${s.rotationOffset}:${s.locationKey ?? ''}`;
}

/** D-18: cancel a pending/active drag only when the view key or view object changed. */
export function shouldCancelDrag(
  prev: { viewKey?: string; view: unknown },
  next: { viewKey?: string; view: unknown },
  dragInProgress: boolean,
): boolean {
  return dragInProgress && (prev.viewKey !== next.viewKey || prev.view !== next.view);
}

/** Close any open popover when the displayed projection or offset changed. */
export function shouldClosePopover(prev: ViewOrientation, next: ViewOrientation): boolean {
  return prev.projection !== next.projection || prev.rotationOffset !== next.rotationOffset;
}
