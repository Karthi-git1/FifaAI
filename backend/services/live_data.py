import json
from pathlib import Path

LIVE_PATH = Path(__file__).resolve().parent.parent / "data" / "live.json"


def load_live_data() -> dict:
    with open(LIVE_PATH, encoding="utf-8") as f:
        return json.load(f)


def gate_for_profile(profile: dict[str, str]) -> str:
    seat = (profile.get("seat") or profile.get("gate") or "").lower()
    if "214" in seat or "gate c" in seat or "201" in seat or "220" in seat:
        return "Gate C"
    if "gate a" in seat or "101" in seat or "120" in seat:
        return "Gate A"
    if "gate b" in seat or "121" in seat:
        return "Gate B"
    if "gate d" in seat or "231" in seat:
        return "Gate D"
    return profile.get("gate") or ""
