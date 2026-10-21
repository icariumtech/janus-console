"""
Tests for core.encounter_state — domain-level mutations on the ActiveView
encounter fields (room visibility, doors, vents, tokens, portraits).

Each function under test calls through to the real `sync_state()` (via
`core.views.active_view`), which persists to active_view_store and builds a
payload via PayloadBuilder. IsolatedStateMixin keeps that off the real
var/active_view.json file used by the dev server.
"""
from unittest import mock

from django.test import TestCase

from core import active_view_store, encounter_state
from core.active_view_store import get_state
from core.tests.state_test_utils import IsolatedStateMixin


class RoomVisibilityTests(IsolatedStateMixin, TestCase):
    def test_toggle_room_defaults_to_visible_then_hides(self):
        # Absent from the dict = visible by default (see codemaps/frontend.md)
        new_visible, state = encounter_state.toggle_room('bridge')
        self.assertFalse(new_visible)
        self.assertEqual(state['encounter_room_visibility']['bridge'], False)

    def test_toggle_room_toggles_back_to_visible(self):
        encounter_state.toggle_room('bridge')
        new_visible, state = encounter_state.toggle_room('bridge')
        self.assertTrue(new_visible)
        self.assertEqual(state['encounter_room_visibility']['bridge'], True)

    def test_toggle_room_explicit_value_overrides_toggle(self):
        new_visible, _ = encounter_state.toggle_room('bridge', visible=False)
        self.assertFalse(new_visible)
        new_visible, _ = encounter_state.toggle_room('bridge', visible=False)
        self.assertFalse(new_visible)

    def test_set_room_visibility_replaces_whole_dict(self):
        encounter_state.toggle_room('bridge', visible=False)
        state = encounter_state.set_room_visibility({'cargo_bay': False})
        self.assertNotIn('bridge', state['encounter_room_visibility'])
        self.assertEqual(state['encounter_room_visibility']['cargo_bay'], False)


class DoorStatusTests(IsolatedStateMixin, TestCase):
    def test_set_door_status_valid(self):
        state = encounter_state.set_door_status('bridge__corridor_1__0', 'LOCKED')
        self.assertEqual(state['encounter_door_status']['bridge__corridor_1__0'], 'LOCKED')

    def test_set_door_status_invalid_raises(self):
        with self.assertRaises(ValueError):
            encounter_state.set_door_status('bridge__corridor_1__0', 'NOT_A_STATUS')

    def test_set_door_status_does_not_clobber_other_doors(self):
        encounter_state.set_door_status('door_a', 'OPEN')
        state = encounter_state.set_door_status('door_b', 'SEALED')
        self.assertEqual(state['encounter_door_status']['door_a'], 'OPEN')
        self.assertEqual(state['encounter_door_status']['door_b'], 'SEALED')


class VentVisibilityTests(IsolatedStateMixin, TestCase):
    def test_set_vents_visible_true(self):
        state = encounter_state.set_vents_visible(True)
        self.assertTrue(state['encounter_vents_visible'])

    def test_set_vents_visible_false(self):
        encounter_state.set_vents_visible(True)
        state = encounter_state.set_vents_visible(False)
        self.assertFalse(state['encounter_vents_visible'])


class TokenLifecycleTests(IsolatedStateMixin, TestCase):
    def test_place_token(self):
        tokens = encounter_state.place_token('somnus', 'main_deck', 'tok_1', {'type': 'npc', 'x': 1, 'y': 2})
        self.assertEqual(tokens['tok_1']['x'], 1)

    def test_get_tokens_for_location_after_place(self):
        encounter_state.place_token('somnus', 'main_deck', 'tok_1', {'type': 'npc', 'x': 1, 'y': 2})
        tokens = encounter_state.get_tokens_for_location('somnus', 'main_deck')
        self.assertIn('tok_1', tokens)

    def test_move_token(self):
        encounter_state.place_token('somnus', 'main_deck', 'tok_1', {'type': 'npc', 'x': 1, 'y': 2})
        tokens = encounter_state.move_token('somnus', 'main_deck', 'tok_1', 5, 6, 'bridge')
        self.assertEqual(tokens['tok_1']['x'], 5)
        self.assertEqual(tokens['tok_1']['y'], 6)
        self.assertEqual(tokens['tok_1']['room_id'], 'bridge')

    def test_move_token_missing_raises_keyerror(self):
        with self.assertRaises(KeyError):
            encounter_state.move_token('somnus', 'main_deck', 'nonexistent', 0, 0, 'bridge')

    def test_remove_token(self):
        encounter_state.place_token('somnus', 'main_deck', 'tok_1', {'type': 'npc', 'x': 1, 'y': 2})
        tokens = encounter_state.remove_token('somnus', 'main_deck', 'tok_1')
        self.assertNotIn('tok_1', tokens)

    def test_remove_token_missing_raises_keyerror(self):
        with self.assertRaises(KeyError):
            encounter_state.remove_token('somnus', 'main_deck', 'nonexistent')

    def test_update_token_status(self):
        encounter_state.place_token('somnus', 'main_deck', 'tok_1', {'type': 'npc', 'x': 1, 'y': 2})
        tokens = encounter_state.update_token_status('somnus', 'main_deck', 'tok_1', ['wounded'])
        self.assertEqual(tokens['tok_1']['status'], ['wounded'])

    def test_clear_tokens(self):
        encounter_state.place_token('somnus', 'main_deck', 'tok_1', {'type': 'npc', 'x': 1, 'y': 2})
        result = encounter_state.clear_tokens('somnus', 'main_deck')
        self.assertEqual(result, {})
        self.assertEqual(encounter_state.get_tokens_for_location('somnus', 'main_deck'), {})

    def test_tokens_scoped_per_deck(self):
        encounter_state.place_token('somnus', 'main_deck', 'tok_1', {'type': 'npc', 'x': 1, 'y': 2})
        encounter_state.place_token('somnus', 'lower_deck', 'tok_2', {'type': 'npc', 'x': 3, 'y': 4})
        self.assertIn('tok_1', encounter_state.get_tokens_for_location('somnus', 'main_deck'))
        self.assertNotIn('tok_2', encounter_state.get_tokens_for_location('somnus', 'main_deck'))
        self.assertIn('tok_2', encounter_state.get_tokens_for_location('somnus', 'lower_deck'))

    def test_legacy_flat_bucket_treated_as_belonging_to_deck_id(self):
        # Simulate a pre-multi-deck flat bucket: {slug: {token_id: token_data}}
        from core.active_view_store import update_state
        update_state(encounter_tokens_by_location={'somnus': {'tok_legacy': {'type': 'npc', 'x': 0, 'y': 0}}})
        tokens = encounter_state.get_tokens_for_location('somnus', 'main_deck')
        self.assertIn('tok_legacy', tokens)


class PortraitTests(IsolatedStateMixin, TestCase):
    def test_toggle_portrait_adds(self):
        portraits = encounter_state.toggle_portrait('npc_1')
        self.assertIn('npc_1', portraits)

    def test_toggle_portrait_removes_when_present(self):
        encounter_state.toggle_portrait('npc_1')
        portraits = encounter_state.toggle_portrait('npc_1')
        self.assertNotIn('npc_1', portraits)


class RotateViewTests(IsolatedStateMixin, TestCase):
    def test_four_clockwise_steps_wrap_to_zero(self):
        offsets = [encounter_state.rotate_view(90)['encounter_rotation_offset'] for _ in range(4)]
        self.assertEqual(offsets, [90, 180, 270, 0])

    def test_counter_clockwise_from_zero_gives_270(self):
        state = encounter_state.rotate_view(-90)
        self.assertEqual(state['encounter_rotation_offset'], 270)

    def test_invalid_deltas_raise_and_leave_state_unchanged(self):
        # 90.0 compares equal to 90, so only an int-only guard rejects it.
        for bad in (90.0, True, '90', None, 0, 45, 180, -180):
            with self.subTest(delta=bad):
                with self.assertRaises(ValueError):
                    encounter_state.rotate_view(bad)
                self.assertEqual(get_state()['encounter_rotation_offset'], 0)

    def test_off_grid_stored_offset_is_treated_as_zero(self):
        # Simulates a bad in-memory value (e.g. loaded before normalization existed).
        for bad in (135, 'x', None, 90.0, True):
            with self.subTest(stored=bad):
                active_view_store.update_state(encounter_rotation_offset=bad)
                state = encounter_state.rotate_view(90)
                self.assertEqual(state['encounter_rotation_offset'], 90)

    def test_step_is_computed_inside_the_store_lock(self):
        # The read-modify-write must be one critical section: the lock is held
        # while the step function reads current state.
        seen = {}
        real = active_view_store.update_state_fn

        def spy(fn):
            def wrapped(state):
                seen['locked'] = active_view_store._lock.locked()
                return fn(state)
            return real(wrapped)

        with mock.patch('core.views.active_view.update_state_fn', spy):
            encounter_state.rotate_view(90)
        self.assertTrue(seen['locked'])

    def test_rotation_survives_store_reload(self):
        encounter_state.rotate_view(90)
        self.assertEqual(active_view_store._load_from_disk()['encounter_rotation_offset'], 90)


class SetProjectionTests(IsolatedStateMixin, TestCase):
    def test_set_iso_then_top_down(self):
        state = encounter_state.set_projection('iso')
        self.assertEqual(state['encounter_projection'], 'iso')
        state = encounter_state.set_projection('top-down')
        self.assertEqual(state['encounter_projection'], 'top-down')

    def test_projection_survives_store_reload(self):
        encounter_state.set_projection('iso')
        self.assertEqual(active_view_store._load_from_disk()['encounter_projection'], 'iso')

    def test_invalid_values_raise_and_leave_state_unchanged(self):
        for bad in ('isometric', 'ISO', '', None, 5, ['iso'], {'p': 'iso'}):
            with self.subTest(projection=bad):
                with self.assertRaises(ValueError):
                    encounter_state.set_projection(bad)
                self.assertEqual(get_state()['encounter_projection'], 'top-down')

    def test_setting_same_projection_twice_is_idempotent(self):
        encounter_state.set_projection('iso')
        state = encounter_state.set_projection('iso')
        self.assertEqual(state['encounter_projection'], 'iso')

    def test_set_projection_leaves_rotation_unchanged(self):
        encounter_state.rotate_view(90)
        state = encounter_state.set_projection('iso')
        self.assertEqual(state['encounter_rotation_offset'], 90)


class DeckSwitchKeepsViewTests(IsolatedStateMixin, TestCase):
    def test_switch_level_leaves_projection_and_rotation_untouched(self):
        encounter_state.set_projection('iso')
        encounter_state.rotate_view(90)
        state = encounter_state.switch_level(2, 'deck_2')
        self.assertEqual(state['encounter_projection'], 'iso')
        self.assertEqual(state['encounter_rotation_offset'], 90)
        self.assertEqual(state['encounter_level'], 2)
