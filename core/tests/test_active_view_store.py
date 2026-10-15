"""
Tests for core.active_view_store — the module-level, disk-persisted state
singleton behind ActiveView. Covers the atomic-write path, deep-copy-on-read
(callers must not be able to mutate the shared in-memory state), and the
merge-over-defaults behavior that lets old on-disk state files gain new keys.
"""
import json
from django.test import TestCase

from core import active_view_store
from core.tests.state_test_utils import IsolatedStateMixin


class GetStateReturnsCopyTests(IsolatedStateMixin, TestCase):
    def test_get_state_returns_a_copy_not_a_live_reference(self):
        state = active_view_store.get_state()
        state['view_type'] = 'MUTATED'
        state['encounter_room_visibility']['room_1'] = False

        fresh = active_view_store.get_state()
        self.assertNotEqual(fresh['view_type'], 'MUTATED')
        self.assertNotIn('room_1', fresh['encounter_room_visibility'])

    def test_get_state_contains_all_default_keys(self):
        state = active_view_store.get_state()
        for key in active_view_store._DEFAULT_STATE:
            self.assertIn(key, state)


class UpdateStateTests(IsolatedStateMixin, TestCase):
    def test_update_state_merges_partial_kwargs(self):
        active_view_store.update_state(view_type='ENCOUNTER')
        state = active_view_store.get_state()
        self.assertEqual(state['view_type'], 'ENCOUNTER')
        # Untouched keys retain their default
        self.assertEqual(state['bridge_tab'], '')

    def test_update_state_returns_full_snapshot(self):
        result = active_view_store.update_state(location_slug='somnus')
        self.assertEqual(result['location_slug'], 'somnus')
        self.assertIn('view_type', result)

    def test_update_state_persists_to_disk(self):
        active_view_store.update_state(view_type='MESSAGES', location_slug='tau-ceti')
        with active_view_store._STATE_PATH.open('r', encoding='utf-8') as f:
            on_disk = json.load(f)
        self.assertEqual(on_disk['view_type'], 'MESSAGES')
        self.assertEqual(on_disk['location_slug'], 'tau-ceti')

    def test_update_state_write_is_atomic_no_tmp_file_left_behind(self):
        active_view_store.update_state(view_type='STANDBY')
        siblings = list(active_view_store._STATE_PATH.parent.iterdir())
        self.assertEqual(siblings, [active_view_store._STATE_PATH])


class LoadFromDiskTests(IsolatedStateMixin, TestCase):
    def test_missing_file_returns_defaults(self):
        # _STATE_PATH points at a tmpdir file that doesn't exist yet
        state = active_view_store._load_from_disk()
        self.assertEqual(state, active_view_store._DEFAULT_STATE)

    def test_merges_stored_values_over_defaults(self):
        active_view_store._STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with active_view_store._STATE_PATH.open('w', encoding='utf-8') as f:
            json.dump({'view_type': 'ENCOUNTER'}, f)

        state = active_view_store._load_from_disk()
        self.assertEqual(state['view_type'], 'ENCOUNTER')
        # Keys absent from the stored file fall back to defaults
        self.assertEqual(state['bridge_tab'], active_view_store._DEFAULT_STATE['bridge_tab'])

    def test_corrupt_json_falls_back_to_defaults(self):
        active_view_store._STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        active_view_store._STATE_PATH.write_text('{not valid json', encoding='utf-8')

        state = active_view_store._load_from_disk()
        self.assertEqual(state, active_view_store._DEFAULT_STATE)

    def test_non_dict_json_falls_back_to_defaults(self):
        active_view_store._STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        active_view_store._STATE_PATH.write_text('[1, 2, 3]', encoding='utf-8')

        state = active_view_store._load_from_disk()
        self.assertEqual(state, active_view_store._DEFAULT_STATE)


class LoadFromDiskViewNormalizationTests(IsolatedStateMixin, TestCase):
    """Stored projection/offset are coerced to the closed enums on load (WR-02)."""

    def _load_with(self, **stored):
        active_view_store._STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        active_view_store._STATE_PATH.write_text(json.dumps(stored), encoding='utf-8')
        return active_view_store._load_from_disk()

    def test_invalid_offsets_fall_back_to_zero(self):
        for bad in (135, -90, 360, '90', 90.5, None, True, [90]):
            with self.subTest(offset=bad):
                self.assertEqual(self._load_with(encounter_rotation_offset=bad)['encounter_rotation_offset'], 0)

    def test_invalid_projections_fall_back_to_top_down(self):
        for bad in ('isometric', 'ISO', 3, None, ['iso']):
            with self.subTest(projection=bad):
                self.assertEqual(self._load_with(encounter_projection=bad)['encounter_projection'], 'top-down')

    def test_valid_values_are_preserved(self):
        state = self._load_with(encounter_projection='iso', encounter_rotation_offset=270)
        self.assertEqual(state['encounter_projection'], 'iso')
        self.assertEqual(state['encounter_rotation_offset'], 270)

    def test_each_field_falls_back_independently(self):
        state = self._load_with(encounter_projection='iso', encounter_rotation_offset=135)
        self.assertEqual(state['encounter_projection'], 'iso')
        self.assertEqual(state['encounter_rotation_offset'], 0)


class ViewStateDefaultsTests(IsolatedStateMixin, TestCase):
    """Phase 34 view-orientation keys and their defaults (D-12)."""

    def test_default_state_holds_view_orientation_defaults(self):
        defaults = active_view_store._DEFAULT_STATE
        self.assertEqual(defaults['encounter_projection'], 'top-down')
        self.assertEqual(defaults['encounter_rotation_offset'], 0)
        self.assertEqual(defaults['encounter_view_location_slug'], '')

    def test_older_state_file_without_the_keys_loads_with_defaults(self):
        active_view_store._STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with active_view_store._STATE_PATH.open('w', encoding='utf-8') as f:
            json.dump({'view_type': 'ENCOUNTER'}, f)

        state = active_view_store._load_from_disk()
        self.assertEqual(state['view_type'], 'ENCOUNTER')
        self.assertEqual(state['encounter_projection'], 'top-down')
        self.assertEqual(state['encounter_rotation_offset'], 0)
        self.assertEqual(state['encounter_view_location_slug'], '')
