"""
Tests pinning the "backend is a thin passthrough for deckplan data" contract
that Phase 31's frontend-owns-validation design depends on (see
docs/schemas/schema-encounters.md and 31-CONTEXT.md's Established Patterns).

`core/data_loader.py::load_deckplan` returns `yaml.safe_load` output verbatim,
and both payload paths (the SSE `PayloadBuilder` and the
`api_encounter_map_data` REST endpoint) forward each deck dict through a
`{**deck, ...}` spread into `normalize_deck_poi`, which shallow-copies the
whole dict rather than rebuilding it from an explicit key allow-list.

A failure anywhere in this suite means an authored deck-level `hull:` or
`details:` value is being silently dropped somewhere between the YAML file
and the browser, with no error surfaced anywhere — exactly the failure mode
plans 31-01 and 31-02 assumed could not happen.
"""
from pathlib import Path

from django.test import TestCase, Client
from django.urls import reverse

from core.payload_builder import PayloadBuilder
from core.encounter_utils import normalize_deck_poi
from core.data_loader import set_loader
from core.tests.test_payload_builder import FakeLoader


TOP_LEVEL_HULL = {
    'polygon': [[0, 0], [10, 0], [10, 10], [0, 10]],
}

UPPER_DECK_HULL = {
    'polygons': [
        [[1, 1], [5, 1], [5, 5], [1, 5]],
        [[8, 8], [12, 8], [12, 12], [8, 12]],
    ],
    'holes': [
        [[2, 2], [3, 2], [3, 3], [2, 3]],
    ],
}

UPPER_DECK_DETAILS = [
    {'room': 'bridge', 'points': [[1, 1], [2, 2], [3, 1]], 'closed': True, 'filled': True},
    {'points': [[5, 5], [6, 6]]},
    {'circle': {'cx': 7, 'cy': 7, 'r': 1.5}},
]


def _multi_deck_deckplan():
    """Two-deck deckplan fixture: main_deck (default, no deck hull) and
    upper_deck (deck-level hull with polygons/holes + a details list),
    alongside a distinct top-level hull so the manifest-vs-deck comparison
    can't pass on an accidental swap."""
    return {
        'name': 'Test Ship',
        'facility_type': 'ship',
        'total_decks': 2,
        'hull': TOP_LEVEL_HULL,
        'decks': [
            {
                'id': 'main_deck',
                'name': 'Main Deck',
                'level': 1,
                'default': True,
                'rooms': [{'id': 'engineering', 'name': 'Engineering',
                           'rects': [{'x': 0, 'y': 0, 'w': 4, 'h': 4}]}],
                'doors': [],
            },
            {
                'id': 'upper_deck',
                'name': 'Upper Deck',
                'level': 2,
                'default': False,
                'hull': UPPER_DECK_HULL,
                'details': UPPER_DECK_DETAILS,
                'rooms': [{'id': 'bridge', 'name': 'Bridge',
                           'rects': [{'x': 0, 'y': 0, 'w': 4, 'h': 4}]}],
                'doors': [],
            },
        ],
    }


class PayloadBuilderDeckplanPassthroughTests(TestCase):
    """Deck-level hull + details survive the SSE payload path (PayloadBuilder)."""

    def setUp(self):
        deckplan = _multi_deck_deckplan()
        location = {
            'type': 'ship',
            'name': 'Test Ship',
            'directory': '/nonexistent/test-loc',
        }
        self.loader = FakeLoader(
            data_dir=Path('/nonexistent'),
            locations={'test-loc': location},
            location_paths={'test-loc': []},
            deckplans={str(Path('/nonexistent/test-loc')): deckplan},
        )
        self.builder = PayloadBuilder(self.loader)

    def _build_for_deck(self, deck_id):
        state = {
            'view_type': 'ENCOUNTER',
            'location_slug': 'test-loc',
            'encounter_deck_id': deck_id,
        }
        return self.builder.build(state)

    def test_manifest_hull_is_the_top_level_hull(self):
        response = self._build_for_deck('upper_deck')
        manifest = response['location_data']['map']['manifest']
        self.assertEqual(manifest['hull'], TOP_LEVEL_HULL)

    def test_deck_hull_polygons_and_holes_survive(self):
        response = self._build_for_deck('upper_deck')
        current_deck = response['location_data']['map']['current_deck']
        self.assertEqual(len(current_deck['hull']['polygons']), 2)
        self.assertEqual(len(current_deck['hull']['holes']), 1)
        self.assertEqual(current_deck['hull'], UPPER_DECK_HULL)
        # The manifest (top-level) and deck-level hulls are distinct fixture
        # values, so a swap between the two would fail this comparison.
        self.assertNotEqual(current_deck['hull'], TOP_LEVEL_HULL)

    def test_deck_details_survive_with_all_keys_intact(self):
        response = self._build_for_deck('upper_deck')
        current_deck = response['location_data']['map']['current_deck']
        self.assertEqual(len(current_deck['details']), 3)
        self.assertEqual(current_deck['details'], UPPER_DECK_DETAILS)
        # Explicitly pin the individual keys named in <behavior>.
        entry_with_room = current_deck['details'][0]
        self.assertEqual(entry_with_room['room'], 'bridge')
        self.assertEqual(entry_with_room['points'], [[1, 1], [2, 2], [3, 1]])
        self.assertTrue(entry_with_room['closed'])
        self.assertTrue(entry_with_room['filled'])
        entry_points_only = current_deck['details'][1]
        self.assertEqual(entry_points_only['points'], [[5, 5], [6, 6]])
        self.assertNotIn('room', entry_points_only)
        entry_circle = current_deck['details'][2]
        self.assertEqual(entry_circle['circle'], {'cx': 7, 'cy': 7, 'r': 1.5})


class NormalizeDeckPoiPassthroughTests(TestCase):
    """`normalize_deck_poi` is a generic shallow-copy, not an allow-list —
    pinned with a key name that appears nowhere else in encounter_utils.py."""

    def test_unknown_deck_keys_survive_normalize_deck_poi(self):
        original = {
            'id': 'upper_deck',
            'rooms': [{'id': 'bridge', 'name': 'Bridge',
                       'rects': [{'x': 0, 'y': 0, 'w': 4, 'h': 4}]}],
            'hull': UPPER_DECK_HULL,
            'details': UPPER_DECK_DETAILS,
            'zzz_regression_probe_key': 'must-survive-untouched',
        }
        result = normalize_deck_poi(original)
        self.assertEqual(result['hull'], UPPER_DECK_HULL)
        self.assertEqual(result['details'], UPPER_DECK_DETAILS)
        self.assertEqual(result['zzz_regression_probe_key'], 'must-survive-untouched')

    def test_normalize_deck_poi_does_not_mutate_the_input_dict(self):
        original = {
            'id': 'upper_deck',
            'rooms': [{'id': 'bridge', 'name': 'Bridge',
                       'rects': [{'x': 0, 'y': 0, 'w': 4, 'h': 4}]}],
            'hull': UPPER_DECK_HULL,
            'details': UPPER_DECK_DETAILS,
        }
        normalize_deck_poi(original)
        self.assertNotIn('poi', original)


class ApiEncounterMapDataDeckplanPassthroughTests(TestCase):
    """Deck-level hull + details survive the REST endpoint
    (api_encounter_map_data), selected via the deck_id query param."""

    def setUp(self):
        self.client = Client()
        deckplan = _multi_deck_deckplan()
        location = {
            'type': 'ship',
            'name': 'Test Ship',
            'directory': '/nonexistent/test-loc',
        }
        loader = FakeLoader(
            data_dir=Path('/nonexistent'),
            locations={'test-loc': location},
            deckplans={str(Path('/nonexistent/test-loc')): deckplan},
        )
        set_loader(loader)

    def tearDown(self):
        # Restore the lazily-constructed real loader for any other test.
        set_loader(None)

    def test_encounter_map_data_endpoint_preserves_deck_hull_and_details(self):
        url = reverse('encounter_map_data', args=['test-loc'])
        response = self.client.get(url, {'deck_id': 'upper_deck'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['current_deck_id'], 'upper_deck')
        self.assertEqual(data['current_deck']['hull'], UPPER_DECK_HULL)
        self.assertEqual(data['current_deck']['details'], UPPER_DECK_DETAILS)
