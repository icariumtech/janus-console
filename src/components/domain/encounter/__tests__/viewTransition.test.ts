import { describe, expect, it } from 'vitest';
import {
  buildViewKey,
  classifyChange,
  FADE_IN_EASE,
  FADE_IN_SECONDS,
  FADE_OUT_EASE,
  FADE_OUT_SECONDS,
  orientationOf,
  planTransition,
  shouldCancelDrag,
  shouldClosePopover,
  type ViewSnapshot,
} from '../viewTransition';
import type { RotationOffset, ViewProjection } from '../geometry/viewOrientation';

const snap = (
  projection: ViewProjection,
  rotationOffset: RotationOffset,
  locationKey?: string,
): ViewSnapshot => ({ projection, rotationOffset, locationKey });

describe('constants', () => {
  it('fade durations are inside the 150-250 ms range', () => {
    for (const s of [FADE_OUT_SECONDS, FADE_IN_SECONDS]) {
      expect(s).toBeGreaterThanOrEqual(0.15);
      expect(s).toBeLessThanOrEqual(0.25);
    }
  });

  it('pins the eases', () => {
    expect(FADE_OUT_EASE).toBe('power1.in');
    expect(FADE_IN_EASE).toBe('power1.out');
  });

  it('both durations are 0.2', () => {
    expect(FADE_OUT_SECONDS).toBe(0.2);
    expect(FADE_IN_SECONDS).toBe(0.2);
  });
});

describe('classifyChange', () => {
  it.each<[ViewProjection, RotationOffset]>([
    ['top-down', 0],
    ['top-down', 270],
    ['iso', 90],
  ])("is 'none' for identical orientation (%s, %i)", (projection, offset) => {
    expect(classifyChange(snap(projection, offset, 'a'), snap(projection, offset, 'a'))).toBe('none');
  });

  it("is 'none' when only the locationKey differs", () => {
    expect(classifyChange(snap('iso', 90, 'a'), snap('iso', 90, 'b'))).toBe('none');
  });

  it.each<[RotationOffset, RotationOffset]>([
    [0, 90],
    [90, 180],
    [270, 0],
    [0, 270],
  ])("is 'fade' for an offset-only change %i -> %i", (from, to) => {
    expect(classifyChange(snap('iso', from, 'a'), snap('iso', to, 'a'))).toBe('fade');
    expect(classifyChange(snap('top-down', from, 'a'), snap('top-down', to, 'a'))).toBe('fade');
  });

  it.each<[RotationOffset, RotationOffset]>([
    [0, 90],
    [90, 180],
    [270, 0],
    [0, 270],
  ])("is 'cut' instead of 'fade' with reduced motion %i -> %i", (from, to) => {
    expect(classifyChange(snap('iso', from), snap('iso', to), true)).toBe('cut');
  });

  it.each<[string, ViewSnapshot, ViewSnapshot]>([
    ['projection only', snap('top-down', 0, 'a'), snap('iso', 0, 'a')],
    ['projection back', snap('iso', 90, 'a'), snap('top-down', 90, 'a')],
    ['projection + offset', snap('top-down', 0, 'a'), snap('iso', 90, 'a')],
    ['offset + location', snap('iso', 0, 'a'), snap('iso', 90, 'b')],
    ['projection + location', snap('top-down', 0, 'a'), snap('iso', 0, 'b')],
    ['offset, undefined -> string location', snap('iso', 0), snap('iso', 90, 'b')],
  ])("is 'cut' for %s", (_label, prev, next) => {
    expect(classifyChange(prev, next)).toBe('cut');
  });

  it('treats two undefined locationKeys as equal', () => {
    expect(classifyChange(snap('iso', 0), snap('iso', 90))).toBe('fade');
  });
});

describe('planTransition', () => {
  const ops = (steps: { op: string }[]) => steps.map((s) => s.op);

  it.each<[RotationOffset, RotationOffset]>([
    [0, 90],
    [90, 180],
    [270, 0],
    [0, 270],
  ])("plans [fadeOut, snap, fadeIn] for an offset-only change %i -> %i", (from, to) => {
    const prev = snap('iso', from, 'a');
    const next = snap('iso', to, 'a');
    const plan = planTransition(prev, next, orientationOf(prev));
    expect(plan.change).toBe('fade');
    expect(ops(plan.steps)).toEqual(['fadeOut', 'snap', 'fadeIn']);
    expect(plan.steps.filter((s) => s.op === 'snap')).toHaveLength(1);
    expect(plan.steps[0]).toEqual({ op: 'fadeOut', seconds: FADE_OUT_SECONDS, ease: FADE_OUT_EASE });
    expect(plan.steps[2]).toEqual({ op: 'fadeIn', seconds: FADE_IN_SECONDS, ease: FADE_IN_EASE });
  });

  it.each<[string, ViewSnapshot, ViewSnapshot, boolean]>([
    ['projection change', snap('top-down', 0, 'a'), snap('iso', 0, 'a'), false],
    ['mixed change', snap('top-down', 0, 'a'), snap('iso', 90, 'a'), false],
    ['location change', snap('iso', 0, 'a'), snap('iso', 90, 'b'), false],
    ['offset change with reduced motion', snap('iso', 0, 'a'), snap('iso', 90, 'a'), true],
  ])('plans a single snap for a %s', (_label, prev, next, reduced) => {
    const plan = planTransition(prev, next, orientationOf(prev), reduced);
    expect(plan.change).toBe('cut');
    expect(plan.steps).toEqual([{ op: 'snap' }]);
  });

  it("plans only fadeIn with change 'restore' when the displayed orientation already equals the request", () => {
    const prev = snap('iso', 0, 'a');
    const next = snap('iso', 90, 'a');
    const displayed = orientationOf(next);
    const plan = planTransition(prev, next, displayed);
    expect(plan.change).toBe('restore');
    expect(ops(plan.steps)).toEqual(['fadeIn']);
  });

  it("returns change 'none' and no steps for an identical request", () => {
    const s = snap('iso', 90, 'a');
    const plan = planTransition(s, { ...s }, orientationOf(s));
    expect(plan).toEqual({ change: 'none', steps: [] });
  });

  it('contains no fade op in any cut plan', () => {
    const plan = planTransition(snap('top-down', 0), snap('iso', 0), { projection: 'top-down', rotationOffset: 0 });
    expect(ops(plan.steps)).not.toContain('fadeOut');
    expect(ops(plan.steps)).not.toContain('fadeIn');
  });
});

describe('orientationOf', () => {
  it('returns only projection and rotationOffset', () => {
    expect(orientationOf(snap('iso', 90, 'a'))).toEqual({ projection: 'iso', rotationOffset: 90 });
  });

  it('reflects whichever snapshot it is handed (the hook passes the latest at snap time)', () => {
    const planned = snap('iso', 90, 'a');
    const latest = snap('iso', 180, 'a');
    expect(orientationOf(planned)).toEqual({ projection: 'iso', rotationOffset: 90 });
    expect(orientationOf(latest)).toEqual({ projection: 'iso', rotationOffset: 180 });
  });
});

describe('buildViewKey', () => {
  it('is equal for identical snapshots', () => {
    expect(buildViewKey(snap('iso', 90, 'a'))).toBe(buildViewKey(snap('iso', 90, 'a')));
  });

  it('treats an absent locationKey like an empty one', () => {
    expect(buildViewKey(snap('iso', 90))).toBe(buildViewKey(snap('iso', 90, '')));
  });

  it.each<[string, ViewSnapshot]>([
    ['projection', snap('top-down', 90, 'a')],
    ['rotationOffset', snap('iso', 180, 'a')],
    ['locationKey', snap('iso', 90, 'b')],
  ])('differs when %s differs', (_label, other) => {
    expect(buildViewKey(other)).not.toBe(buildViewKey(snap('iso', 90, 'a')));
  });
});

describe('shouldCancelDrag (D-18)', () => {
  const viewA = { id: 'A' };
  const viewB = { id: 'B' };

  it('is false for an unrelated re-render with a drag in progress', () => {
    expect(shouldCancelDrag({ viewKey: 'a', view: viewA }, { viewKey: 'a', view: viewA }, true)).toBe(false);
  });

  it('is true when the view key changed during a drag', () => {
    expect(shouldCancelDrag({ viewKey: 'a', view: viewA }, { viewKey: 'b', view: viewA }, true)).toBe(true);
  });

  it('is true when the view object changed during a drag', () => {
    expect(shouldCancelDrag({ viewKey: 'a', view: viewA }, { viewKey: 'a', view: viewB }, true)).toBe(true);
  });

  it('is false for any change when nothing is dragging', () => {
    expect(shouldCancelDrag({ viewKey: 'a', view: viewA }, { viewKey: 'b', view: viewB }, false)).toBe(false);
  });
});

describe('shouldClosePopover', () => {
  it.each<[string, ViewSnapshot, ViewSnapshot, boolean]>([
    ['projection changed', snap('top-down', 90), snap('iso', 90), true],
    ['offset changed', snap('iso', 90), snap('iso', 180), true],
    ['both equal', snap('iso', 90, 'a'), snap('iso', 90, 'b'), false],
  ])('%s', (_label, prev, next, expected) => {
    expect(shouldClosePopover(orientationOf(prev), orientationOf(next))).toBe(expected);
  });
});
