import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { EncounterMapRenderer } from '../EncounterMapRenderer';
import type { GridEncounterMapData } from '../../../../types/encounterMap';
import type { ViewControl } from '../geometry/viewOrientation';

// G-34-5: the GM view-control cluster reads [rotate-ccw][projection][rotate-cw]
// with larger rotate glyphs, 44px touch targets, and unchanged direction wiring.

const MAP: GridEncounterMapData = {
  name: 'Test Deck',
  rooms: [{ id: 'r1', name: 'Room', rects: [{ x: 0, y: 0, w: 2, h: 2 }] }],
};

type ButtonKind = 'rotate-ccw' | 'projection-toggle' | 'rotate-cw';

let mounted: { root: Root; container: HTMLDivElement }[] = [];

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
});

afterEach(async () => {
  for (const { root, container } of mounted) {
    await act(async () => root.unmount());
    container.remove();
  }
  mounted = [];
});

async function mount(viewControl?: ViewControl): Promise<HTMLDivElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => {
    root.render(<EncounterMapRenderer mapData={MAP} viewControl={viewControl} />);
  });
  return container;
}

function clusterButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('.encounter-map__view-controls > button'),
  );
}

function kindOf(button: HTMLButtonElement): ButtonKind {
  const kinds: ButtonKind[] = ['rotate-ccw', 'projection-toggle', 'rotate-cw'];
  const found = kinds.find((k) => button.classList.contains(`encounter-map__${k}`));
  if (!found) throw new Error(`unclassified cluster button: ${button.className}`);
  return found;
}

// Joined into one string so a failing assertion reports on a single line.
function order(container: HTMLElement): string {
  return clusterButtons(container).map(kindOf).join(' > ');
}

function byKind(container: HTMLElement, kind: ButtonKind): HTMLButtonElement {
  const el = clusterButtons(container).find((b) => kindOf(b) === kind);
  if (!el) throw new Error(`missing ${kind}`);
  return el;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

describe('EncounterMapRenderer view-control cluster (G-34-5)', () => {
  it('local mode renders rotate-ccw, projection toggle, rotate-cw in that order', async () => {
    const c = await mount({ mode: 'local' });
    expect(order(c)).toBe('rotate-ccw > projection-toggle > rotate-cw');
  });

  it('broadcast mode with both callbacks renders rotate-ccw, projection toggle, rotate-cw in that order', async () => {
    const c = await mount({ mode: 'broadcast', onProjectionChange: vi.fn(), onRotate: vi.fn() });
    expect(order(c)).toBe('rotate-ccw > projection-toggle > rotate-cw');
  });

  it('broadcast mode with only onRotate renders the rotate pair without a toggle', async () => {
    const c = await mount({ mode: 'broadcast', onRotate: vi.fn() });
    expect(order(c)).toBe('rotate-ccw > rotate-cw');
  });

  it('broadcast mode with only onProjectionChange renders the toggle alone', async () => {
    const c = await mount({ mode: 'broadcast', onProjectionChange: vi.fn() });
    expect(order(c)).toBe('projection-toggle');
  });

  it('read-only mount renders no cluster', async () => {
    const c = await mount({ mode: 'readonly' });
    expect(c.querySelector('.encounter-map__view-controls')).toBeNull();
    const d = await mount();
    expect(d.querySelector('.encounter-map__view-controls')).toBeNull();
  });

  it('rotate-ccw calls onRotate(-90) and rotate-cw calls onRotate(90)', async () => {
    const onRotate = vi.fn();
    const c = await mount({ mode: 'broadcast', onRotate });
    await click(byKind(c, 'rotate-ccw'));
    expect(onRotate).toHaveBeenLastCalledWith(-90);
    await click(byKind(c, 'rotate-cw'));
    expect(onRotate).toHaveBeenLastCalledWith(90);
    expect(onRotate).toHaveBeenCalledTimes(2);
  });

  it('projection toggle calls onProjectionChange with the opposite projection', async () => {
    const onProjectionChange = vi.fn();
    const c = await mount({ mode: 'broadcast', onProjectionChange });
    await click(byKind(c, 'projection-toggle'));
    expect(onProjectionChange).toHaveBeenCalledWith('iso');
  });

  it('rotate glyph buttons render their glyph larger than the 11px toggle label', async () => {
    const c = await mount({ mode: 'broadcast', onProjectionChange: vi.fn(), onRotate: vi.fn() });
    const toggleSize = parseFloat(byKind(c, 'projection-toggle').style.fontSize);
    expect(toggleSize).toBe(11);
    for (const kind of ['rotate-ccw', 'rotate-cw'] as const) {
      const size = parseFloat(byKind(c, kind).style.fontSize);
      expect(size).toBeGreaterThanOrEqual(16);
      expect(size).toBeGreaterThan(toggleSize);
    }
  });

  it('every cluster button keeps 44px minimum width and height', async () => {
    const c = await mount({ mode: 'local' });
    const buttons = clusterButtons(c);
    expect(buttons).toHaveLength(3);
    for (const b of buttons) {
      expect(b.style.minWidth).toBe('44px');
      expect(b.style.minHeight).toBe('44px');
    }
  });
});
