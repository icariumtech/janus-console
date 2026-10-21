"""
End-to-end tests for the shared encounter view orientation (Phase 34).

The GM presses rotate on the tactical map; the server advances the shared
rotation offset from its CURRENT state (never from a client-supplied absolute
value), persists it, and broadcasts it on the SSE `activeview` event. These
tests walk that whole path: HTTP -> state -> disk -> payload -> SSE.
"""
import json
from pathlib import Path
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from core import active_view_store
from core.active_view_store import get_state
from core.sse_broadcaster import broadcaster
from core import encounter_state
from core.tests.state_test_utils import IsolatedStateMixin
from core.tests.test_payload_builder import FakeLoader
from core.views.active_view import build_active_view_payload


class RotateViewEndToEndTests(IsolatedStateMixin, TestCase):
    def setUp(self):
        super().setUp()
        user = get_user_model().objects.create_user('gm', password='pw')
        self.client = Client()
        self.client.force_login(user)
        self.url = reverse('encounter_rotate_view')
        self.listener = broadcaster.listen()
        self.addCleanup(broadcaster.unlisten, self.listener)

    def _post(self, body, client=None):
        return (client or self.client).post(
            self.url, data=json.dumps(body), content_type='application/json'
        )

    def test_rotate_clockwise_returns_new_offset(self):
        response = self._post({'delta': 90})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': True, 'rotation_offset': 90})

    def test_rotate_advances_server_state_from_defaults(self):
        self._post({'delta': 90})
        state = get_state()
        self.assertEqual(state['encounter_rotation_offset'], 90)
        self.assertEqual(state['encounter_projection'], 'top-down')

    def test_rotate_persists_to_disk(self):
        self._post({'delta': 90})
        with active_view_store._STATE_PATH.open('r', encoding='utf-8') as f:
            on_disk = json.load(f)
        self.assertEqual(on_disk['encounter_rotation_offset'], 90)

    def test_rotation_is_relative_and_wraps_modulo_360(self):
        # Two clicks each apply exactly one step; counter-clockwise from 0 wraps.
        self._post({'delta': 90})
        self._post({'delta': 90})
        self.assertEqual(get_state()['encounter_rotation_offset'], 180)
        self._post({'delta': -90})
        self._post({'delta': -90})
        self._post({'delta': -90})
        self.assertEqual(get_state()['encounter_rotation_offset'], 270)

    def test_payload_builder_carries_view_fields(self):
        self._post({'delta': 90})
        payload = build_active_view_payload(get_state())
        self.assertEqual(payload['encounter_rotation_offset'], 90)
        self.assertEqual(payload['encounter_projection'], 'top-down')

    def test_sse_activeview_event_carries_view_fields(self):
        self._post({'delta': 90})
        message = self.listener.get_nowait()
        self.assertTrue(message.startswith('event: activeview\n'))
        data_line = next(line for line in message.splitlines() if line.startswith('data: '))
        payload = json.loads(data_line[len('data: '):])
        self.assertEqual(payload['encounter_rotation_offset'], 90)
        self.assertEqual(payload['encounter_projection'], 'top-down')

    def test_invalid_delta_is_rejected_and_state_unchanged(self):
        response = self._post({'delta': 45})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(get_state()['encounter_rotation_offset'], 0)

    def test_anonymous_post_is_redirected_and_state_unchanged(self):
        response = self._post({'delta': 90}, client=Client())
        self.assertEqual(response.status_code, 302)
        self.assertEqual(get_state()['encounter_rotation_offset'], 0)


class _GmClientMixin:
    """Logged-in GM client plus a broadcaster listener, shared by endpoint tests."""

    url_name = ''

    def setUp(self):
        super().setUp()
        self.user = get_user_model().objects.create_user('gm', password='pw')
        self.client = Client()
        self.client.force_login(self.user)
        self.url = reverse(self.url_name)
        self.listener = broadcaster.listen()
        self.addCleanup(broadcaster.unlisten, self.listener)

    def _post(self, body, client=None, raw=False):
        payload = body if raw else json.dumps(body)
        return (client or self.client).post(
            self.url, data=payload, content_type='application/json'
        )

    def _csrf_client(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        return client


class RotateViewHardeningTests(_GmClientMixin, IsolatedStateMixin, TestCase):
    url_name = 'encounter_rotate_view'

    def test_malformed_deltas_return_400_and_state_unchanged(self):
        cases = [
            {'delta': '90'}, {'delta': 90.0}, {'delta': True}, {'delta': None},
            {'delta': 0}, {'delta': 180}, {},
        ]
        for body in cases:
            with self.subTest(body=body):
                response = self._post(body)
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.json())
                self.assertEqual(get_state()['encounter_rotation_offset'], 0)

    def test_non_object_bodies_return_400_not_500(self):
        for body in ([90], 90, 'x'):
            with self.subTest(body=body):
                response = self._post(body)
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.json())
                self.assertEqual(get_state()['encounter_rotation_offset'], 0)

    def test_csrf_token_is_required(self):
        response = self._post({'delta': 90}, client=self._csrf_client())
        self.assertEqual(response.status_code, 403)
        self.assertEqual(get_state()['encounter_rotation_offset'], 0)

    def test_four_steps_wrap_and_counter_clockwise_from_zero(self):
        for expected in (90, 180, 270, 0):
            self._post({'delta': 90})
            self.assertEqual(get_state()['encounter_rotation_offset'], expected)
        self._post({'delta': -90})
        self.assertEqual(get_state()['encounter_rotation_offset'], 270)

    def test_rotated_value_survives_store_reload(self):
        self._post({'delta': 90})
        self.assertEqual(active_view_store._load_from_disk()['encounter_rotation_offset'], 90)


class SetProjectionEndpointTests(_GmClientMixin, IsolatedStateMixin, TestCase):
    url_name = 'encounter_set_projection'

    def test_set_iso_returns_200_and_updates_state(self):
        response = self._post({'projection': 'iso'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'success': True, 'projection': 'iso'})
        self.assertEqual(get_state()['encounter_projection'], 'iso')

    def test_sse_event_carries_projection_and_keeps_rotation(self):
        self._post({'projection': 'iso'})
        message = self.listener.get_nowait()
        self.assertTrue(message.startswith('event: activeview\n'))
        data_line = next(line for line in message.splitlines() if line.startswith('data: '))
        payload = json.loads(data_line[len('data: '):])
        self.assertEqual(payload['encounter_projection'], 'iso')
        self.assertEqual(payload['encounter_rotation_offset'], 0)

    def test_invalid_projection_returns_400_and_state_unchanged(self):
        cases = [
            {'projection': 'sideways'}, {'projection': ''}, {'projection': 'ISO'},
            {'projection': 'isometric'}, {'projection': None}, {'projection': 5},
            {'projection': ['iso']}, {},
        ]
        for body in cases:
            with self.subTest(body=body):
                response = self._post(body)
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.json())
                self.assertEqual(get_state()['encounter_projection'], 'top-down')

    def test_non_object_body_returns_400(self):
        response = self._post(['iso'])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(get_state()['encounter_projection'], 'top-down')

    def test_anonymous_post_is_redirected_and_state_unchanged(self):
        response = self._post({'projection': 'iso'}, client=Client())
        self.assertEqual(response.status_code, 302)
        self.assertEqual(get_state()['encounter_projection'], 'top-down')

    def test_csrf_token_is_required(self):
        response = self._post({'projection': 'iso'}, client=self._csrf_client())
        self.assertEqual(response.status_code, 403)
        self.assertEqual(get_state()['encounter_projection'], 'top-down')

    def test_projection_survives_store_reload(self):
        self._post({'projection': 'iso'})
        self.assertEqual(active_view_store._load_from_disk()['encounter_projection'], 'iso')


def _deckplan(default_view=None, with_view_key=True):
    plan = {
        'name': 'Test', 'total_decks': 2, 'hull': None,
        'decks': [
            {'id': 'lower', 'level': 0, 'rooms': [{'id': 'engine'}]},
            {'id': 'main_deck', 'level': 1, 'default': True, 'rooms': [{'id': 'bridge'}]},
        ],
    }
    if with_view_key:
        plan['default_view'] = default_view
    return plan


class SwitchViewDefaultViewTests(IsolatedStateMixin, TestCase):
    """api_switch_view applies a location's authored default view once per location change."""

    def setUp(self):
        super().setUp()
        user = get_user_model().objects.create_user('gm', password='pw')
        self.client = Client()
        self.client.force_login(user)
        self.url = reverse('api_switch_view')
        self.listener = broadcaster.listen()
        self.addCleanup(broadcaster.unlisten, self.listener)

        def loc(name):
            return {'type': 'ship', 'name': name, 'directory': f'/nonexistent/{name}'}

        self.loader = FakeLoader(
            data_dir=Path('/nonexistent'),
            locations={
                'test-loc': loc('test-loc'),
                'plain-loc': loc('plain-loc'),
                'bad-loc': loc('bad-loc'),
                'nodir-loc': {'type': 'ship', 'name': 'nodir', 'directory': None},
            },
            deckplans={
                str(Path('/nonexistent/test-loc')): _deckplan({'projection': 'iso', 'rotation_offset': 90}),
                str(Path('/nonexistent/plain-loc')): _deckplan(with_view_key=False),
                str(Path('/nonexistent/bad-loc')): _deckplan({'projection': 'sideways', 'rotation_offset': 45}),
            },
        )
        patcher = mock.patch('core.views.navigation.get_loader', return_value=self.loader)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _switch(self, view_type, slug=None):
        body = {'view_type': view_type}
        if slug is not None:
            body['location_slug'] = slug
        return self.client.post(self.url, data=json.dumps(body), content_type='application/json')

    def _view(self):
        state = get_state()
        return state['encounter_projection'], state['encounter_rotation_offset']

    def test_first_entry_applies_authored_default_view_and_marker(self):
        self._switch('ENCOUNTER', 'test-loc')
        state = get_state()
        self.assertEqual(self._view(), ('iso', 90))
        self.assertEqual(state['encounter_view_location_slug'], 'test-loc')

    def test_sse_payload_carries_applied_view(self):
        self._switch('ENCOUNTER', 'test-loc')
        message = self.listener.get_nowait()
        data_line = next(line for line in message.splitlines() if line.startswith('data: '))
        payload = json.loads(data_line[len('data: '):])
        self.assertEqual(payload['encounter_projection'], 'iso')
        self.assertEqual(payload['encounter_rotation_offset'], 90)
        self.assertNotIn('encounter_view_location_slug', payload)

    def test_returning_via_bridge_keeps_the_gms_live_view(self):
        self._switch('ENCOUNTER', 'test-loc')
        encounter_state.set_projection('top-down')
        encounter_state.rotate_view(90)  # 90 -> 180
        self._switch('BRIDGE')
        self._switch('ENCOUNTER', 'test-loc')
        self.assertEqual(self._view(), ('top-down', 180))

    def test_reselecting_same_slug_in_encounter_keeps_the_live_view(self):
        self._switch('ENCOUNTER', 'test-loc')
        encounter_state.set_projection('top-down')
        encounter_state.rotate_view(90)
        self._switch('ENCOUNTER', 'test-loc')
        self.assertEqual(self._view(), ('top-down', 180))

    def test_different_location_without_default_view_resets_to_defaults(self):
        self._switch('ENCOUNTER', 'test-loc')
        self._switch('ENCOUNTER', 'plain-loc')
        self.assertEqual(self._view(), ('top-down', 0))
        self.assertEqual(get_state()['encounter_view_location_slug'], 'plain-loc')

    def test_location_without_directory_resets_to_defaults(self):
        self._switch('ENCOUNTER', 'test-loc')
        self._switch('ENCOUNTER', 'nodir-loc')
        self.assertEqual(self._view(), ('top-down', 0))
        self.assertEqual(get_state()['encounter_view_location_slug'], 'nodir-loc')

    def test_unknown_slug_resets_to_defaults(self):
        self._switch('ENCOUNTER', 'test-loc')
        self._switch('ENCOUNTER', 'missing-loc')
        self.assertEqual(self._view(), ('top-down', 0))

    def test_hostile_default_view_is_normalized_defensively(self):
        encounter_state.set_projection('iso')
        encounter_state.rotate_view(90)
        self._switch('ENCOUNTER', 'bad-loc')
        self.assertEqual(self._view(), ('top-down', 0))

    def test_standby_changes_neither_view_nor_marker(self):
        self._switch('ENCOUNTER', 'test-loc')
        self._switch('STANDBY')
        self.assertEqual(self._view(), ('iso', 90))
        self.assertEqual(get_state()['encounter_view_location_slug'], 'test-loc')

    def test_new_location_still_initializes_portraits_rooms_and_default_deck(self):
        encounter_state.toggle_portrait('npc_1')
        self._switch('ENCOUNTER', 'test-loc')
        state = get_state()
        self.assertEqual(state['encounter_active_portraits'], [])
        self.assertEqual(state['encounter_room_visibility'], {'engine': False, 'bridge': False})
        self.assertEqual(state['encounter_level'], 1)
        self.assertEqual(state['encounter_deck_id'], 'main_deck')
