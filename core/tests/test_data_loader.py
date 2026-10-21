"""
Regression tests for DataLoader deckplan-only loading (Phase 29 Plan 01, EDIT-01).

Guards against regression of the legacy loader removal:
  - load_map / load_encounter_manifest / load_deck_map must not exist on the loader
  - load_deckplan() must return non-empty decks for the somnus ship location
  - load_deckplan() must return empty sentinel for a directory with no deckplan.yaml
"""
import tempfile
from pathlib import Path
from django.test import TestCase
from django.conf import settings
from core.data_loader import DataLoader
from core.encounter_view import DEFAULT_VIEW, normalize_default_view


class DataLoaderDeckplanTests(TestCase):
    """Tests for the deckplan-only loading path (EDIT-01)."""

    def setUp(self):
        self.loader = DataLoader(getattr(settings, 'DATA_DIR', 'data'))

    # ------------------------------------------------------------------ #
    # Legacy method absence                                                #
    # ------------------------------------------------------------------ #

    def test_load_map_does_not_exist(self):
        """load_map() must not be present — removed in Phase 29."""
        self.assertFalse(
            hasattr(self.loader, 'load_map'),
            "load_map() was found on DataLoader — it should have been removed in Phase 29",
        )

    def test_load_encounter_manifest_does_not_exist(self):
        """load_encounter_manifest() must not be present — removed in Phase 29."""
        self.assertFalse(
            hasattr(self.loader, 'load_encounter_manifest'),
            "load_encounter_manifest() was found on DataLoader — it should have been removed in Phase 29",
        )

    def test_load_deck_map_does_not_exist(self):
        """load_deck_map() must not be present — removed in Phase 29."""
        self.assertFalse(
            hasattr(self.loader, 'load_deck_map'),
            "load_deck_map() was found on DataLoader — it should have been removed in Phase 29",
        )

    # ------------------------------------------------------------------ #
    # load_deckplan() — somnus (real deckplan.yaml)                        #
    # ------------------------------------------------------------------ #

    def test_somnus_load_deckplan_returns_non_empty_decks(self):
        """load_deckplan() on the somnus ship directory returns at least one deck."""
        somnus_dir = Path(self.loader.data_dir) / 'ships' / 'somnus'
        if not somnus_dir.exists():
            self.skipTest("data/ships/somnus not present in test environment")
        result = self.loader.load_deckplan(somnus_dir)
        self.assertIn('decks', result)
        self.assertGreater(len(result['decks']), 0, "Expected at least one deck in somnus deckplan")

    def test_somnus_load_deckplan_first_deck_has_rooms(self):
        """The first deck of the somnus deckplan contains rooms."""
        somnus_dir = Path(self.loader.data_dir) / 'ships' / 'somnus'
        if not somnus_dir.exists():
            self.skipTest("data/ships/somnus not present in test environment")
        result = self.loader.load_deckplan(somnus_dir)
        first_deck = result['decks'][0]
        self.assertIn('rooms', first_deck)
        self.assertGreater(len(first_deck['rooms']), 0, "Expected rooms in the first somnus deck")

    def test_somnus_load_deckplan_main_deck_id(self):
        """The somnus deckplan's first deck has id 'main_deck'."""
        somnus_dir = Path(self.loader.data_dir) / 'ships' / 'somnus'
        if not somnus_dir.exists():
            self.skipTest("data/ships/somnus not present in test environment")
        result = self.loader.load_deckplan(somnus_dir)
        self.assertEqual(result['decks'][0]['id'], 'main_deck')

    def test_somnus_load_deckplan_hull_present(self):
        """The somnus deckplan has a hull polygon."""
        somnus_dir = Path(self.loader.data_dir) / 'ships' / 'somnus'
        if not somnus_dir.exists():
            self.skipTest("data/ships/somnus not present in test environment")
        result = self.loader.load_deckplan(somnus_dir)
        self.assertIsNotNone(result.get('hull'))
        self.assertIn('polygon', result['hull'])
        self.assertGreater(len(result['hull']['polygon']), 0)

    # ------------------------------------------------------------------ #
    # load_deckplan() — directory with no deckplan.yaml (empty sentinel)  #
    # ------------------------------------------------------------------ #

    def test_load_deckplan_missing_file_returns_empty_sentinel(self):
        """load_deckplan() on a directory without deckplan.yaml returns the empty sentinel dict."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            result = self.loader.load_deckplan(Path(tmp_dir))
        self.assertEqual(result['decks'], [])
        self.assertIsNone(result['hull'])
        self.assertEqual(result['total_decks'], 0)


class DefaultViewNormalizationTests(TestCase):
    """normalize_default_view validates each field against the closed enums and never raises."""

    DEFAULTS = {'projection': 'top-down', 'rotation_offset': 0}

    def test_non_mapping_values_yield_defaults(self):
        for raw in (None, {}, 'iso', [], 5):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_default_view(raw), self.DEFAULTS)

    def test_returns_fresh_dict_each_call(self):
        result = normalize_default_view(None)
        result['projection'] = 'iso'
        self.assertEqual(DEFAULT_VIEW, self.DEFAULTS)
        self.assertIsNot(normalize_default_view(None), DEFAULT_VIEW)

    def test_valid_values_pass_through(self):
        for projection in ('top-down', 'iso'):
            for offset in (0, 90, 180, 270):
                with self.subTest(projection=projection, offset=offset):
                    raw = {'projection': projection, 'rotation_offset': offset}
                    self.assertEqual(normalize_default_view(raw), raw)

    def test_invalid_projection_falls_back_for_that_field_only_and_warns(self):
        with self.assertLogs('core.encounter_view', level='WARNING') as logs:
            result = normalize_default_view({'projection': 'sideways', 'rotation_offset': 90})
        self.assertEqual(result, {'projection': 'top-down', 'rotation_offset': 90})
        self.assertEqual(len(logs.records), 1)
        self.assertIn('projection', logs.output[0])

    def test_invalid_offset_falls_back_for_that_field_only(self):
        with self.assertLogs('core.encounter_view', level='WARNING'):
            result = normalize_default_view({'projection': 'iso', 'rotation_offset': 45})
        self.assertEqual(result, {'projection': 'iso', 'rotation_offset': 0})

    def test_rejected_offset_types_and_ranges(self):
        for bad in (True, 90.0, '90', -90, 360):
            with self.subTest(offset=bad):
                with self.assertLogs('core.encounter_view', level='WARNING'):
                    result = normalize_default_view({'rotation_offset': bad})
                self.assertEqual(result['rotation_offset'], 0)

    def test_unknown_extra_keys_are_ignored(self):
        result = normalize_default_view({'projection': 'iso', 'zoom': 3})
        self.assertEqual(result, {'projection': 'iso', 'rotation_offset': 0})

    def test_missing_fields_default_without_warning(self):
        with self.assertNoLogs('core.encounter_view', level='WARNING'):
            self.assertEqual(normalize_default_view({'projection': None}), self.DEFAULTS)
            self.assertEqual(normalize_default_view({'rotation_offset': 90})['projection'], 'top-down')


class LoadDeckplanDefaultViewTests(TestCase):
    """load_deckplan returns a normalized default_view on both return paths."""

    def setUp(self):
        self.loader = DataLoader(getattr(settings, 'DATA_DIR', 'data'))

    def _load(self, extra_yaml=''):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (Path(tmp_dir) / 'deckplan.yaml').write_text(
                extra_yaml + 'decks:\n  - id: main_deck\n    name: Main\n    level: 1\n    rooms: []\n'
            )
            return self.loader.load_deckplan(Path(tmp_dir))

    def test_missing_file_returns_default_view(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            result = self.loader.load_deckplan(Path(tmp_dir))
        self.assertEqual(result['default_view'], {'projection': 'top-down', 'rotation_offset': 0})
        self.assertIsNot(result['default_view'], DEFAULT_VIEW)

    def test_authored_default_view_is_returned(self):
        result = self._load('default_view: {projection: iso, rotation_offset: 180}\n')
        self.assertEqual(result['default_view'], {'projection': 'iso', 'rotation_offset': 180})

    def test_invalid_field_degrades_per_field_without_raising(self):
        with self.assertLogs('core.encounter_view', level='WARNING'):
            result = self._load('default_view: {projection: nope, rotation_offset: 90}\n')
        self.assertEqual(result['default_view'], {'projection': 'top-down', 'rotation_offset': 90})
        self.assertEqual(result['total_decks'], 1)

    def test_absent_default_view_yields_defaults(self):
        result = self._load()
        self.assertEqual(result['default_view'], {'projection': 'top-down', 'rotation_offset': 0})
        self.assertIsNot(result['default_view'], DEFAULT_VIEW)

    def test_existing_keys_unchanged(self):
        result = self._load('hull: {polygon: [[0, 0], [1, 0], [1, 1]]}\n')
        self.assertEqual([d['id'] for d in result['decks']], ['main_deck'])
        self.assertIn('polygon', result['hull'])
        self.assertEqual(result['total_decks'], 1)
