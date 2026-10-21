import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, useRef } from 'react';
import { usePanZoom } from '../usePanZoom';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

// Content laid out at a negative offset inside the container, like the
// renderer's oversized svg (left/top = size × (1 − GRID_MARGIN_MULTIPLIER) / 2).
const LAYOUT_LEFT = -1200;
const LAYOUT_TOP = -900;
const CONTAINER_LEFT = 37;
const CONTAINER_TOP = 64;

type View = { panX: number; panY: number; zoom: number };
let latest: View = { panX: 0, panY: 0, zoom: 1 };

function rect(left: number, top: number): DOMRect {
  return { left, top, right: left, bottom: top, width: 0, height: 0, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function Harness({ withOrigin }: { withOrigin: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewState, containerHandlers } = usePanZoom(
    containerRef,
    withOrigin ? { x: LAYOUT_LEFT, y: LAYOUT_TOP } : undefined,
  );
  latest = viewState;
  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        // Container sits away from the page origin so client→container math is exercised.
        if (el) el.getBoundingClientRect = () => rect(CONTAINER_LEFT, CONTAINER_TOP);
      }}
      {...containerHandlers}
    />
  );
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function mount(withOrigin: boolean): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Harness withOrigin={withOrigin} />));
  return host.firstElementChild as HTMLElement;
}

function wheel(target: HTMLElement, clientX: number, clientY: number, deltaY: number) {
  act(() => {
    target.dispatchEvent(new WheelEvent('wheel', { clientX, clientY, deltaY, bubbles: true, cancelable: true }));
  });
}

// Content-local point currently drawn under the given client point
// (content box at container + layout offset, transformed translate(pan) scale(zoom)).
function pointUnder(clientX: number, clientY: number, layoutLeft: number, layoutTop: number) {
  return {
    x: (clientX - CONTAINER_LEFT - layoutLeft - latest.panX) / latest.zoom,
    y: (clientY - CONTAINER_TOP - layoutTop - latest.panY) / latest.zoom,
  };
}

describe('usePanZoom wheel zoom', () => {
  it('keeps the point under the cursor fixed when content is offset (contentOrigin)', () => {
    const container = mount(true);
    const [cx, cy] = [420, 310];
    const before = pointUnder(cx, cy, LAYOUT_LEFT, LAYOUT_TOP);

    for (const deltaY of [-100, -100, -100, 100, 100, -100, 100, 100, 100]) {
      wheel(container, cx, cy, deltaY);
      const now = pointUnder(cx, cy, LAYOUT_LEFT, LAYOUT_TOP);
      expect(now.x).toBeCloseTo(before.x, 6);
      expect(now.y).toBeCloseTo(before.y, 6);
    }
    expect(latest.zoom).not.toBe(1);
  });

  it('anchors at the container origin when no contentOrigin is given', () => {
    const container = mount(false);
    const [cx, cy] = [200, 150];
    const before = pointUnder(cx, cy, 0, 0);
    wheel(container, cx, cy, -100);
    wheel(container, cx, cy, -100);
    const now = pointUnder(cx, cy, 0, 0);
    expect(now.x).toBeCloseTo(before.x, 6);
    expect(now.y).toBeCloseTo(before.y, 6);
  });
});
