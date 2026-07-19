"""
Live stadium data loader
========================
Reads ``data/live.json`` on every call so the API always returns the latest
crowd levels, wait times, and alerts without requiring a server restart.

Gate inference
--------------
``gate_for_profile`` maps a fan's seat string to the nearest gate using a
simple keyword / section-number lookup.  This avoids asking the fan to know
their gate in advance — they only need their seat number.
"""

import json
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Absolute path to the live data file, resolved relative to this module.
LIVE_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "live.json"

#: Mapping of seat-string keywords → gate name.
#: Checked in order; first match wins.
_GATE_RULES: list[tuple[list[str], str]] = [
    (["214", "gate c", "201", "220"], "Gate C"),
    (["gate a", "101", "120"],        "Gate A"),
    (["gate b", "121"],               "Gate B"),
    (["gate d", "231"],               "Gate D"),
]


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def load_live_data() -> dict:
    """
    Load and return the current live stadium data from disk.

    The file is read on every call so changes to ``live.json`` (e.g. from a
    data-feed simulator) are reflected immediately in API responses.

    Returns:
        Parsed JSON dict with keys: ``gates``, ``alerts``, ``match``, etc.
    """
    with open(LIVE_DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def gate_for_profile(profile: dict[str, str]) -> str:
    """
    Infer the nearest gate from the fan's seat or gate string.

    Checks ``profile["seat"]`` first, then ``profile["gate"]``, against a set
    of keyword rules.  Falls back to the explicit ``gate`` value if no rule
    matches, or an empty string if neither field is set.

    Args:
        profile: Fan profile dict.  Relevant keys: ``"seat"``, ``"gate"``.

    Returns:
        Gate name string, e.g. ``"Gate C"``, or ``""`` if undetermined.

    Examples:
        >>> gate_for_profile({"seat": "Section 214, Row A"})
        'Gate C'
        >>> gate_for_profile({"seat": "101 VIP"})
        'Gate A'
        >>> gate_for_profile({"gate": "Gate B"})
        'Gate B'
    """
    seat_text = (profile.get("seat") or profile.get("gate") or "").lower()

    for keywords, gate_name in _GATE_RULES:
        if any(kw in seat_text for kw in keywords):
            return gate_name

    # No rule matched — return the explicit gate value if set, otherwise empty
    return profile.get("gate") or ""
