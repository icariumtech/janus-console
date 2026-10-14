"""
Shared constants for the GM-controlled encounter view (Phase 34).

The encounter projection and rotation offset are server-owned, GM-controlled
state broadcast to every client. These closed enums are the single source of
truth for what may ever be stored: the setters, the deckplan `default_view`
normalizer and the view-switch logic all validate against them.
"""

PROJECTIONS = ('top-down', 'iso')
ROTATION_OFFSETS = (0, 90, 180, 270)
ROTATION_DELTAS = (90, -90)

# Initial view for a location with no authored default. Never mutated;
# consumers copy it (dict(DEFAULT_VIEW)).
DEFAULT_VIEW = {'projection': 'top-down', 'rotation_offset': 0}
