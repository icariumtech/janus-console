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

type View = { panX: number; panY: number; zoom: number };
let latest: View = { panX: 0, panY: 0, zoom: 1 };

function rect(left: number, top: number): DOMRect {
  return { left, top, right: left, bottom: top, width: 0, height: 0, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function Harness({ withContent }: { withContent: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { viewState, containerHandlers } = usePanZoom(containerRef, withContent ? contentRef : undefined);
  latest = viewState;
  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) el.getBoundingClientRect = () => rect(0, 0);
      }}
      {...containerHandlers}
    >
      <div
        ref={(el) => {
          contentRef.current = el;
          // Rendered top-left of a translate(pan) scale(zoom) box with origin 0 0.
          if (el) el.getBoundingClientRect = () => rect(LAYOUT_LEFT + latest.panX, LAYOUT_TOP + latest.panY);
        }}
      />
    </div>
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

function mount(withContent: boolean): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Harness withContent={withContent} />));
  return host.firstElementChild as HTMLElement;
}

function wheel(target: HTMLElement, clientX: number, clientY: number, deltaY: number) {
  act(() => {
    target.dispatchEvent(new WheelEvent('wheel', { clientX, clientY, deltaY, bubbles: true, cancelable: true }));
  });
}

// Content-local point currently drawn under the given client point.
function pointUnder(clientX: number, clientY: number, layoutLeft: number, layoutTop: number) {
  return {
    x: (clientX - layoutLeft - latest.panX) / latest.zoom,
    y: (clientY - layoutTop - latest.panY) / latest.zoom,
  };
}

describe('usePanZoom wheel zoom', () => {
  it('keeps the point under the cursor fixed when content is offset (contentRef)', () => {
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

  it('anchors at the container origin when no contentRef is given', () => {
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
