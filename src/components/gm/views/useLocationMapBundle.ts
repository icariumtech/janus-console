import { useEffect, useRef, useState } from 'react';
import { encounterApi, type DeckWithRooms } from '@/services/encounterApi';
import type {
  EncounterManifest,
  EncounterMapData,
  GridEncounterMapData,
  MapDataResponse,
  RoomVisibilityState,
} from '@/types/encounterMap';

type DeckMapData = EncounterMapData | GridEncounterMapData;

/**
 * Everything the GM tactical map needs for one location, committed as a unit:
 * the displayed deck map, the manifest (hull) and the all-decks listing are
 * never taken from different locations (G-34-6).
 */
export interface LocationMapBundle {
  slug: string;
  mapData: DeckMapData;
  manifest: EncounterManifest | null;
  allDecks: DeckWithRooms[];
  roomVisibility: RoomVisibilityState;
}

interface UseLocationMapBundleOptions {
  locationSlug: string;
  enabled: boolean;
  currentDeckId: string;
  /** Called in the same synchronous block as the bundle commit (null when the unit is cleared). */
  onLocationBundle: (bundle: LocationMapBundle | null) => void;
  onError: (message: string) => void;
}

// The displayed deck of a getMapData response: current_deck for multi-deck
// locations, otherwise the response itself.
function pickDeckMap(data: MapDataResponse): DeckMapData {
  if ('is_multi_deck' in data && data.is_multi_deck) return data.current_deck;
  return data as EncounterMapData;
}

/**
 * Loads and binds {slug, mapData, manifest, allDecks, roomVisibility} as one
 * stale-guarded unit.
 *
 * - A new location loads the deck map and the manifest together (Promise.all)
 *   and commits them in one block; either request failing clears the unit.
 * - Until then the previously committed bundle stays as it was, so the caller
 *   can keep the old map on screen in its own view.
 * - A superseded run (location changed again, or unmounted) never touches
 *   state or callbacks.
 * - A deck switch inside the committed location refetches only the deck map.
 */
export function useLocationMapBundle({
  locationSlug,
  enabled,
  currentDeckId,
  onLocationBundle,
  onError,
}: UseLocationMapBundleOptions) {
  const [bundle, setBundle] = useState<LocationMapBundle | null>(null);
  const [loading, setLoading] = useState(false);

  const bundleRef = useRef<LocationMapBundle | null>(null);
  const onLocationBundleRef = useRef(onLocationBundle);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);
  useEffect(() => {
    onLocationBundleRef.current = onLocationBundle;
    onErrorRef.current = onError;
  }, [onLocationBundle, onError]);

  useEffect(() => {
    if (!locationSlug || !enabled) {
      setBundle(null);
      setLoading(false);
      onLocationBundleRef.current(null);
      return;
    }

    let cancelled = false;

    if (bundleRef.current?.slug === locationSlug) {
      // Deck switch (or returning to the displayed location): deck map only.
      setLoading(false);
      encounterApi
        .getMapData(locationSlug)
        .then((data) => {
          if (cancelled) return;
          const mapData = pickDeckMap(data);
          setBundle((prev) => (prev && prev.slug === locationSlug ? { ...prev, mapData } : prev));
        })
        .catch((err) => {
          if (cancelled) return;
          // A transient deck-map failure must not blank the map.
          console.error('Error loading current deck map:', err);
        });
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    const load = async () => {
      try {
        const [allDecksData, mapResponse] = await Promise.all([
          encounterApi.getAllDecks(locationSlug),
          encounterApi.getMapData(locationSlug),
        ]);
        if (cancelled) return;
        const next: LocationMapBundle = {
          slug: locationSlug,
          mapData: pickDeckMap(mapResponse),
          manifest: allDecksData.manifest || null,
          allDecks: allDecksData.decks || [],
          roomVisibility: allDecksData.room_visibility || {},
        };
        setBundle(next);
        setLoading(false);
        onLocationBundleRef.current(next);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading map data:', err);
        setBundle(null);
        setLoading(false);
        onErrorRef.current('Failed to load map data');
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [locationSlug, enabled, currentDeckId]);

  return { bundle, loading };
}
