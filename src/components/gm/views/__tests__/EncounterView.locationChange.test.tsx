import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { EncounterView } from '../EncounterView';
import type { ActiveView } from '@/types/gmConsole';
import type { DoorStatusState, RoomVisibilityState, TokenState } from '@/types/encounterMap';

// G-34-6: on a GM location change the tactical map must never render one
// location's map together with another location's hull, locationKey, view,
// tokens, doors, room visibility or vents flag. While the new location loads,
// the old map stays frozen in its own view; every mutating GM control is
// unavailable during that freeze (T-34-28) and returns with the new bundle.

interface Call {
  slug: string;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  settled: boolean;
}

const h = vi.hoisted(() => {
  const mutating = [
    'toggleRoom',
    'setDoorStatus',
    'placeToken',
    'moveToken',
    'removeToken',
    'updateTokenStatus',
    'clearAllTokens',
    'setVentsVisible',
    'showAllRooms',
    'hideAllRooms',
    'switchLevel',
    'rotateView',
    'setProjection',
  ];
  const mapCalls: Call[] = [];
  const decksCalls: Call[] = [];
  const track = (calls: Call[]) => (slug: string) =>
    new Promise((resolve, reject) => {
      calls.push({ slug, resolve, reject, settled: false });
    });
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    getMapData: vi.fn(track(mapCalls)),
    getAllDecks: vi.fn(track(decksCalls)),
    togglePortrait: vi.fn(async () => ({})),
  };
  for (const name of mutating) fns[name] = vi.fn(async () => ({}));
  return {
    mutating,
    fns,
    mapCalls,
    decksCalls,
    mapLog: [] as unknown[],
    paletteLog: [] as number[],
  };
});

vi.mock('@/services/encounterApi', () => ({ encounterApi: h.fns }));

vi.mock('@/components/gm/MapPreview', () => ({
  MapPreview: (props: Record<string, unknown>) => {
    h.mapLog.push({ ...props });
    return null;
  },
}));

vi.mock('@/components/gm/panels/TokenPalettePanel', () => ({
  TokenPalettePanel: () => {
    h.paletteLog.push(1);
    return null;
  },
}));

interface Rendered {
  mapData: unknown;
  hull: unknown;
  locationKey: unknown;
  viewOrientation?: { projection: string; rotationOffset: number };
  tokens: unknown;
  doorStatus: unknown;
  roomVisibility: unknown;
  ventsVisible: unknown;
  viewControl?: Record<string, unknown>;
  [key: string]: unknown;
}

interface Fixture {
  slug: string;
  projection: 'top-down' | 'iso';
  offset: number;
  multi: boolean;
  map: object;
  map2?: object;
  hull: object;
  manifest: object;
  deckList: object[];
  tokens: TokenState;
  doors: DoorStatusState;
  vis: RoomVisibilityState;
  vents: boolean;
}

function makeFixture(
  slug: string,
  projection: 'top-down' | 'iso',
  offset: number,
  vents: boolean,
  twoDecks: boolean,
): Fixture {
  const deckIds = twoDecks ? [`${slug}-d1`, `${slug}-d2`] : [`${slug}-d1`];
  const hull = { name: `hull-${slug}`, outline: [] };
  const deckMap = (id: string) => ({
    name: `${slug} ${id}`,
    rooms: [{ id: `${slug}-r1`, name: 'Room', rects: [{ x: 0, y: 0, w: 2, h: 2 }] }],
  });
  return {
    slug,
    projection,
    offset,
    multi: slug === 'a',
    map: deckMap(deckIds[0]),
    map2: twoDecks ? deckMap(deckIds[1]) : undefined,
    hull,
    manifest: {
      name: slug,
      total_decks: deckIds.length,
      decks: deckIds.map((id, i) => ({ id, name: id, level: i + 1 })),
      hull,
    },
    deckList: deckIds.map((id, i) => ({
      id,
      name: id,
      level: i + 1,
      rooms: i === 0 ? [{ id: `${slug}-r1`, name: 'Room', rects: [] }] : [],
    })),
    tokens: { [`t-${slug}`]: { id: `t-${slug}` } } as unknown as TokenState,
    doors: { [`d-${slug}`]: 'open' } as unknown as DoorStatusState,
    vis: { [`${slug}-r1`]: true },
    vents,
  };
}

const FIX: Record<string, Fixture> = {
  a: makeFixture('a', 'top-down', 0, false, true),
  b: makeFixture('b', 'iso', 90, true, false),
  c: makeFixture('c', 'top-down', 180, false, false),
};
const ALL = Object.values(FIX);

function makeActiveView(
  slug: string,
  deckId: string = `${slug}-d1`,
  overrides: Partial<ActiveView> = {},
): ActiveView {
  const f = FIX[slug];
  return {
    location_slug: slug,
    view_type: 'ENCOUNTER',
    view_slug: '',
    overlay_location_slug: '',
    overlay_terminal_slug: '',
    overlay_doc_slug: '',
    janus_mode: 'DISPLAY',
    janus_dialog_open: false,
    location_type: 'ship',
    location_name: slug,
    encounter_level: 1,
    encounter_deck_id: deckId,
    encounter_room_visibility: f.vis,
    encounter_door_status: f.doors,
    encounter_tokens: f.tokens,
    encounter_vents_visible: f.vents,
    encounter_projection: f.projection,
    encounter_rotation_offset: f.offset,
    encounter_active_portraits: [],
    encounter_npc_data: {},
    updated_at: '',
    ...overrides,
  } as ActiveView;
}

function decksResponse(f: Fixture) {
  return {
    is_multi_deck: f.deckList.length > 1,
    manifest: f.manifest,
    decks: f.deckList,
    room_visibility: f.vis,
  };
}

function mapResponse(f: Fixture, deck2 = false) {
  if (f.multi) {
    return {
      is_multi_deck: true,
      manifest: f.manifest,
      current_deck: deck2 ? f.map2 : f.map,
      current_deck_id: deck2 ? `${f.slug}-d2` : `${f.slug}-d1`,
    };
  }
  return f.map;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const EXPANDED = new Set<string>();
const noop = () => {};
let root: Root;
let container: HTMLDivElement;
let consoleSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

beforeEach(() => {
  h.mapLog.length = 0;
  h.paletteLog.length = 0;
  h.mapCalls.length = 0;
  h.decksCalls.length = 0;
  for (const fn of Object.values(h.fns)) fn.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  consoleSpy?.mockRestore();
  consoleSpy = undefined;
});

async function render(activeView: ActiveView) {
  await act(async () => {
    root.render(
      <EncounterView
        activeView={activeView}
        locations={[]}
        expandedNodes={EXPANDED}
        onToggleNode={noop}
        onSelectLocation={noop}
        onShowTerminal={noop}
        janusChannel=""
        janusDialogOpen={false}
        onDialogToggle={noop}
      />,
    );
  });
}

type Kind = 'map' | 'decks';
type Order = 'map-first' | 'manifest-first';
const ORDERS: Order[] = ['map-first', 'manifest-first'];
const firstOf = (o: Order): Kind => (o === 'map-first' ? 'map' : 'decks');
const secondOf = (o: Order): Kind => (o === 'map-first' ? 'decks' : 'map');

async function settle(kind: Kind, slug: string, how: 'ok' | 'fail' = 'ok', deck2 = false) {
  const calls = kind === 'map' ? h.mapCalls : h.decksCalls;
  const call = [...calls].reverse().find((c) => c.slug === slug && !c.settled);
  if (!call) throw new Error(`no pending ${kind} request for ${slug}`);
  call.settled = true;
  const f = FIX[slug];
  await act(async () => {
    if (how === 'fail') call.reject(new Error('boom'));
    else call.resolve(kind === 'map' ? mapResponse(f, deck2) : decksResponse(f));
  });
}

async function loadLocation(slug: string, order: Order = 'map-first') {
  await settle(firstOf(order), slug);
  await settle(secondOf(order), slug);
}

async function mountAndLoad(slug: string, deckId?: string) {
  await render(makeActiveView(slug, deckId));
  await loadLocation(slug);
}

const log = () => h.mapLog as Rendered[];
const last = () => log()[log().length - 1];

// Which fixture(s) each field of one MapPreview render belongs to.
function fieldOwners(r: Rendered): Record<string, string> {
  const own = (pred: (f: Fixture) => boolean) =>
    ALL.filter(pred)
      .map((f) => f.slug)
      .join('|') || 'none';
  return {
    map: own((f) => r.mapData === f.map || r.mapData === f.map2),
    hull: own((f) => r.hull === f.hull),
    key: own((f) => r.locationKey === f.slug),
    view: own(
      (f) =>
        r.viewOrientation?.projection === f.projection && r.viewOrientation?.rotationOffset === f.offset,
    ),
    tokens: own((f) => r.tokens === f.tokens),
    doors: own((f) => r.doorStatus === f.doors),
    vis: own((f) => r.roomVisibility === f.vis),
    vents: own((f) => r.ventsVisible === f.vents),
  };
}

// One location's slug when every field belongs to it, otherwise a single-line MIXED description.
function tupleOf(r: Rendered): string {
  const per = fieldOwners(r);
  const common = ALL.map((f) => f.slug).filter((s) => Object.values(per).every((o) => o.split('|').includes(s)));
  if (common.length === 1) return common[0];
  return `MIXED(${Object.entries(per)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')})`;
}

const tuples = () => log().map(tupleOf);
const mixedRenders = () => tuples().filter((t) => t.startsWith('MIXED')).join(' ; ');
const sawTuple = (slug: string) => tuples().includes(slug);

const CALLBACKS = [
  'onDoorStatusChange',
  'onTokenPlace',
  'onTokenMove',
  'onTokenRemove',
  'onTokenStatusToggle',
  'onRoomToggle',
  'onVentsToggle',
];
const ALL_CALLBACKS = CALLBACKS.join(',');
const liveCallbacks = (r: Rendered) => CALLBACKS.filter((k) => typeof r[k] === 'function').join(',');
const liveViewControl = (r: Rendered) =>
  ['onRotate', 'onProjectionChange'].filter((k) => typeof r.viewControl?.[k] === 'function').join(',');
const calledMutating = () => h.mutating.filter((n) => h.fns[n].mock.calls.length > 0).join(',');

function button(text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === text) ??
    null
  );
}
const buttonState = (text: string) => {
  const b = button(text);
  return b ? (b.disabled ? 'disabled' : 'enabled') : 'absent';
};
const deckSelectState = () => {
  const el = container.querySelector('.gm-encounter-view__floating-controls .ant-select');
  return el ? (el.classList.contains('ant-select-disabled') ? 'disabled' : 'enabled') : 'absent';
};

async function click(el: HTMLElement | null) {
  await act(async () => {
    el?.click();
  });
}

async function openTokenPalette() {
  await click(container.querySelector<HTMLButtonElement>('button[aria-label="Token Palette"]'));
}

function expectFrozenOn(slug: string) {
  expect(tupleOf(last())).toBe(slug);
}

function expectGateClosed() {
  const r = last();
  expect(liveCallbacks(r)).toBe('');
  expect(liveViewControl(r)).toBe('');
  expect(buttonState('REVEAL ALL')).toBe('disabled');
  expect(buttonState('HIDE ALL')).toBe('disabled');
  expect(deckSelectState()).toBe('disabled');
  expect(h.paletteLog.length).toBe(0);
}

async function expectDisabledClicksInert() {
  await click(button('REVEAL ALL'));
  await click(button('HIDE ALL'));
  expect(calledMutating()).toBe('');
}

function expectGateOpen() {
  const r = last();
  expect(liveCallbacks(r)).toBe(ALL_CALLBACKS);
  expect(liveViewControl(r)).toBe('onRotate,onProjectionChange');
  expect(buttonState('REVEAL ALL')).toBe('enabled');
  expect(buttonState('HIDE ALL')).toBe('enabled');
  expect(deckSelectState()).not.toBe('disabled');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EncounterView location change (G-34-6)', () => {
  it('first load commits map and hull together', async () => {
    await render(makeActiveView('a'));
    expect(log().length).toBe(0);
    await settle('map', 'a');
    expect(log().length).toBe(0);
    await settle('decks', 'a');
    expect(log().length).toBeGreaterThan(0);
    expect(tuples().filter((t) => t !== 'a').join(' ; ')).toBe('');
    expectFrozenOn('a');
  });

  for (const order of ORDERS) {
    it(`location change a to b (top-down to iso), ${order}: never renders a mixed tuple`, async () => {
      await mountAndLoad('a');
      await render(makeActiveView('b'));
      expectFrozenOn('a');
      await settle(firstOf(order), 'b');
      expectFrozenOn('a');
      await settle(secondOf(order), 'b');
      expectFrozenOn('b');
      expect(mixedRenders()).toBe('');
    });

    it(`location change b to a (iso to top-down), ${order}: never renders a mixed tuple`, async () => {
      await mountAndLoad('b');
      await render(makeActiveView('a'));
      expectFrozenOn('b');
      await settle(firstOf(order), 'a');
      expectFrozenOn('b');
      await settle(secondOf(order), 'a');
      expectFrozenOn('a');
      expect(mixedRenders()).toBe('');
    });

    it(`location change a to b, ${order}: map-scoped inputs stay the displayed location's during the freeze`, async () => {
      await mountAndLoad('a');
      await render(makeActiveView('b'));
      const frozen = () => {
        const per = fieldOwners(last());
        expect(per.tokens, 'frozen tokens owner').toBe('a');
        expect(per.doors, 'frozen doors owner').toBe('a');
        expect(per.vis, 'frozen vis owner').toBe('a');
        expect(per.vents.split('|'), 'frozen vents owner').toContain('a');
        expect(per.vents.split('|'), 'frozen vents owner').not.toContain('b');
      };
      frozen();
      await settle(firstOf(order), 'b');
      frozen();
      // A further activeView update for b while a is frozen must not leak.
      await render(makeActiveView('b', 'b-d1', { encounter_tokens: { fresh: { id: 'fresh' } } as unknown as TokenState }));
      frozen();
      await settle(secondOf(order), 'b');
      const per = fieldOwners(last());
      expect(per.vis).toBe('b');
      expect(per.doors).toBe('b');
      expect(per.vents).toBe('b');
      expect(per.key).toBe('b');
    });

    it(`location change a to b, ${order}: mutating controls are unavailable during the freeze`, async () => {
      await mountAndLoad('a');
      await openTokenPalette();
      h.paletteLog.length = 0;
      await render(makeActiveView('b'));
      expectGateClosed();
      await expectDisabledClicksInert();
      await settle(firstOf(order), 'b');
      expectGateClosed();
      await expectDisabledClicksInert();
      expect(calledMutating()).toBe('');
    });
  }

  it('location change a to b: the gate lifts with the bundle', async () => {
    await mountAndLoad('a');
    await openTokenPalette();
    h.paletteLog.length = 0;
    await render(makeActiveView('b'));
    await loadLocation('b');
    expectFrozenOn('b');
    expectGateOpen();
    expect(h.paletteLog.length).toBeGreaterThan(0);
    await click(button('REVEAL ALL'));
    expect(JSON.stringify(h.fns.showAllRooms.mock.calls)).toBe('[[["b-r1"]]]');
  });

  it('location change a to b to c: a late b response never replaces c', async () => {
    await mountAndLoad('a');
    await render(makeActiveView('b'));
    await render(makeActiveView('c'));
    await loadLocation('c');
    await settle('decks', 'b');
    await settle('map', 'b');
    expectFrozenOn('c');
    expect(sawTuple('b')).toBe(false);
  });

  it('location change a to b and back to a: late b responses are discarded and the gate stays open', async () => {
    await mountAndLoad('a');
    await render(makeActiveView('b'));
    await render(makeActiveView('a'));
    await settle('map', 'a');
    await settle('decks', 'b');
    await settle('map', 'b');
    expectFrozenOn('a');
    expect(sawTuple('b')).toBe(false);
    expectGateOpen();
  });

  it('deck switch inside a location refetches only the deck map and keeps the gate open', async () => {
    await mountAndLoad('a');
    const mark = log().length;
    expect(h.fns.getAllDecks.mock.calls.length).toBe(1);
    expect(h.fns.getMapData.mock.calls.length).toBe(1);
    await render(makeActiveView('a', 'a-d2'));
    expect(h.fns.getAllDecks.mock.calls.length).toBe(1);
    expect(h.fns.getMapData.mock.calls.length).toBe(2);
    expectGateOpen();
    await settle('map', 'a', 'ok', true);
    const r = last();
    expect(r.mapData).toBe(FIX.a.map2);
    expect(r.hull).toBe(FIX.a.hull);
    expect(r.locationKey).toBe('a');
    expect(r.viewOrientation?.projection).toBe('top-down');
    expect(r.viewOrientation?.rotationOffset).toBe(0);
    expectGateOpen();
    expect(
      log()
        .slice(mark)
        .filter((x) => liveCallbacks(x) !== ALL_CALLBACKS).length,
    ).toBe(0);
  });

  it('failed manifest request leaves nothing half-loaded and the next location loads', async () => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await mountAndLoad('a');
    await render(makeActiveView('b'));
    await settle('decks', 'b', 'fail');
    const afterFailure = log().length;
    await settle('map', 'b');
    expect(log().length).toBe(afterFailure);
    expect(mixedRenders()).toBe('');
    expect(sawTuple('b')).toBe(false);
    expect(buttonState('REVEAL ALL')).toBe('absent');
    expect(calledMutating()).toBe('');
    await render(makeActiveView('c'));
    await loadLocation('c');
    expectFrozenOn('c');
    expect(sawTuple('b')).toBe(false);
  });

  it('before any bundle exists no map and no controls render and nothing mutating is called', async () => {
    await render(makeActiveView('a'));
    await settle('map', 'a');
    expect(log().length).toBe(0);
    expect(buttonState('REVEAL ALL')).toBe('absent');
    expect(buttonState('HIDE ALL')).toBe('absent');
    expect(calledMutating()).toBe('');
  });
});
