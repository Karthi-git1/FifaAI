"""Updates live.json every 20s to simulate real-time stadium data."""

import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path

LIVE_PATH = Path(__file__).resolve().parent / "data" / "live.json"
GATES = ["Gate A", "Gate B", "Gate C", "Gate D"]
LEVELS = ["low", "moderate", "high"]


def tick() -> dict:
    with open(LIVE_PATH, encoding="utf-8") as f:
        data = json.load(f)

    for gate in GATES:
        wait = max(2, data["gates"][gate]["wait_minutes"] + random.randint(-3, 4))
        if gate == "Gate C":
            wait = max(5, wait + random.randint(0, 3))
        level = "low" if wait < 6 else "moderate" if wait < 12 else "high"
        data["gates"][gate] = {
            "wait_minutes": wait,
            "level": level,
            "throughput": "slow" if level == "high" else "normal",
        }

    for name in data["restrooms"]:
        w = max(1, data["restrooms"][name]["wait_minutes"] + random.randint(-2, 3))
        data["restrooms"][name] = {
            "wait_minutes": w,
            "status": "busy" if w > 6 else "available",
        }

    data["transit"]["shuttle_downtown"]["next_departure_min"] = max(
        2, data["transit"]["shuttle_downtown"]["next_departure_min"] - 1
    )
    if data["transit"]["shuttle_downtown"]["next_departure_min"] <= 1:
        data["transit"]["shuttle_downtown"]["next_departure_min"] = 12

    gc_wait = data["gates"]["Gate C"]["wait_minutes"]
    data["alerts"] = []
    if gc_wait >= 12:
        data["alerts"].append("Gate C queue building — consider Gate B + east concourse walk")
    if data["restrooms"]["East (Gate C)"]["wait_minutes"] > 7:
        data["alerts"].append("East restrooms busy — try South (Gate D) restrooms")

    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["halftime_rush"] = random.random() < 0.15

    with open(LIVE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return data


if __name__ == "__main__":
    print("Live data simulator running (Ctrl+C to stop)…")
    while True:
        d = tick()
        print(f"[{d['updated_at']}] Gate C: {d['gates']['Gate C']['wait_minutes']} min")
        time.sleep(20)
