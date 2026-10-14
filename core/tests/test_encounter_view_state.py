"""
End-to-end tests for the shared encounter view orientation (Phase 34).

The GM presses rotate on the tactical map; the server advances the shared
rotation offset from its CURRENT state (never from a client-supplied absolute
value), persists it, and broadcasts it on the SSE `activeview` event. These
tests walk that whole path: HTTP -> state -> disk -> payload -> SSE.
"""
import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from core import active_view_store
from core.active_view_store import get_state
from core.sse_broadcaster import broadcaster
from core.tests.state_test_utils import IsolatedStateMixin
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
