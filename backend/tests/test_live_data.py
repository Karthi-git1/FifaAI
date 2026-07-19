import pytest
from services.live_data import gate_for_profile

def test_gate_for_profile():
    assert gate_for_profile({"seat": "Section 214, Row A"}) == "Gate C"
    assert gate_for_profile({"seat": "101 VIP"}) == "Gate A"
    assert gate_for_profile({"gate": "Gate B", "seat": ""}) == "Gate B"
    # Fallback default
    assert gate_for_profile({"seat": "Unknown Area 999"}) == "Gate C"
    assert gate_for_profile({}) == "Gate C"
