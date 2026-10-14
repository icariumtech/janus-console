/**
 * useOrientationTransition — executes the vitest-covered transition plan
 * (./viewTransition) with GSAP and React state, and returns the orientation
 * currently DISPLAYED on the encounter map.
 *
 * This hook holds no decision logic: ordering, durations, eases, the snap
 * target and the none/cut/fade/restore classification all come from
 * `planTransition` / `orientationOf`. It only translates a plan into GSAP calls.
 *
 * GSAP exclusively owns the fade target's inline opacity. React never sets
 * opacity on that element, so the two can never fight over it.
 *
 * Unrelated to src/hooks/useViewTransition.ts (app-level view-type transitions).
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { planTransition, orientationOf, type ViewSnapshot } from './viewTransition';
import type { ViewOrientation } from './geometry/viewOrientation';

/** jsdom and some embedded webviews have no matchMedia. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * @param requested - the orientation (and location) the map was asked to show
 * @param fadeTargetRef - element whose opacity is faded (wrapper around the svg)
 * @param onSnap - called exactly when the displayed orientation changes (pan/zoom reset, D-13)
 */
export function useOrientationTransition(
  requested: ViewSnapshot,
  fadeTargetRef: RefObject<HTMLElement | null>,
  onSnap: () => void,
): ViewOrientation {
  const [displayed, setDisplayed] = useState<ViewOrientation>(() => orientationOf(requested));

  const prevRef = useRef<ViewSnapshot>(requested);
  const latestRef = useRef<ViewSnapshot>(requested);
  const displayedRef = useRef<ViewOrientation>(displayed);
  const onSnapRef = useRef(onSnap);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const applyDisplayed = (next: ViewOrientation) => {
    displayedRef.current = next;
    setDisplayed(next);
  };

  // Keyed ONLY on primitives so updates that change nothing (SSE ticks, token
  // moves, room toggles) never run the transition path (no fade, no reset).
  useLayoutEffect(() => {
    latestRef.current = requested;
    onSnapRef.current = onSnap;

    const prev = prevRef.current;
    prevRef.current = requested;

    const plan = planTransition(prev, requested, displayedRef.current, prefersReducedMotion());
    if (plan.change === 'none') return;

    timelineRef.current?.kill();
    timelineRef.current = null;

    const target = fadeTargetRef.current;

    if (plan.change === 'cut' || !target) {
      if (target) gsap.set(target, { clearProps: 'opacity' });
      applyDisplayed(orientationOf(requested));
      onSnapRef.current();
      return;
    }

    const tl = gsap.timeline();
    for (const step of plan.steps) {
      if (step.op === 'fadeOut') {
        tl.to(target, { opacity: 0, duration: step.seconds, ease: step.ease });
      } else if (step.op === 'snap') {
        // Read the LATEST request at snap time, never the value captured when
        // the plan was made (UI-SPEC race row — no step queue).
        tl.add(() => {
          applyDisplayed(orientationOf(latestRef.current));
          onSnapRef.current();
        });
      } else {
        tl.to(target, {
          opacity: 1,
          duration: step.seconds,
          ease: step.ease,
          onComplete: () => {
            gsap.set(target, { clearProps: 'opacity' });
          },
        });
      }
    }
    timelineRef.current = tl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested.projection, requested.rotationOffset, requested.locationKey]);

  // A leaked timeline can never leave the map at opacity 0.
  useEffect(
    () => () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      const target = fadeTargetRef.current;
      if (target) gsap.set(target, { clearProps: 'opacity' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return displayed;
}
