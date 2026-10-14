"""
Shared constants for the GM-controlled encounter view (Phase 34).

The encounter projection and rotation offset are server-owned, GM-controlled
state broadcast to every client. These closed enums are the single source of
truth for what may ever be stored: the setters, the deckplan `default_view`
normalizer and the view-switch logic all validate against them.
"""
import logging

logger = logging.getLogger(__name__)

PROJECTIONS = ('top-down', 'iso')
ROTATION_OFFSETS = (0, 90, 180, 270)
ROTATION_DELTAS = (90, -90)

# Initial view for a location with no authored default. Never mutated;
# consumers copy it (dict(DEFAULT_VIEW)).
DEFAULT_VIEW = {'projection': 'top-down', 'rotation_offset': 0}


def normalize_default_view(raw) -> dict:
    """Normalize an authored deckplan `default_view` into a safe view dict.

    Each field falls back to its default independently, so one bad value never
    discards the other. A missing field (absent or None) takes its default
    silently; an invalid one is logged as a warning. Never raises, so a
    malformed deckplan can not block a location from loading, and only enum
    values are ever returned for the store.
    """
    view = dict(DEFAULT_VIEW)
    if not isinstance(raw, dict):
        return view

    projection = raw.get('projection')
    if projection is not None:
        if isinstance(projection, str) and projection in PROJECTIONS:
            view['projection'] = projection
        else:
            logger.warning(
                "Ignoring invalid default_view.projection %r (expected one of %s)",
                projection, ', '.join(PROJECTIONS),
            )

    offset = raw.get('rotation_offset')
    if offset is not None:
        if isinstance(offset, int) and not isinstance(offset, bool) and offset in ROTATION_OFFSETS:
            view['rotation_offset'] = offset
        else:
            logger.warning(
                "Ignoring invalid default_view.rotation_offset %r (expected one of %s)",
                offset, ', '.join(str(o) for o in ROTATION_OFFSETS),
            )

    return view
