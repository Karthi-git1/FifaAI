import pytest
from services.live_data import gate_for_profile, load_live_data


# ── gate_for_profile ─────────────────────────────────────────────────────────

class TestGateForProfile:
    def test_section_214_maps_to_gate_c(self):
        assert gate_for_profile({"seat": "Section 214, Row A"}) == "Gate C"

    def test_section_101_maps_to_gate_a(self):
        assert gate_for_profile({"seat": "101 VIP"}) == "Gate A"

    def test_explicit_gate_b_in_seat_string(self):
        assert gate_for_profile({"seat": "Gate B Block 5"}) == "Gate B"

    def test_explicit_gate_passed_directly(self):
        assert gate_for_profile({"gate": "Gate B", "seat": ""}) == "Gate B"

    def test_unknown_seat_falls_back_to_empty(self):
        # No matching rule and no gate key → empty string (caller handles default)
        result = gate_for_profile({"seat": "Unknown Area 999"})
        assert result == ""

    def test_empty_profile_returns_empty(self):
        assert gate_for_profile({}) == ""

    def test_section_220_maps_to_gate_c(self):
        assert gate_for_profile({"seat": "Row 220"}) == "Gate C"

    def test_section_231_maps_to_gate_d(self):
        assert gate_for_profile({"seat": "Block 231"}) == "Gate D"

    def test_gate_field_takes_priority_when_no_seat_match(self):
        assert gate_for_profile({"gate": "Gate D", "seat": "Some Unknown Block"}) == "Gate D"

    def test_case_insensitive_gate_matching(self):
        assert gate_for_profile({"seat": "gate a vip lounge"}) == "Gate A"

    def test_none_values_dont_crash(self):
        # Should not raise even if values are None
        result = gate_for_profile({"seat": None, "gate": None})
        assert isinstance(result, str)


# ── load_live_data ────────────────────────────────────────────────────────────

class TestLoadLiveData:
    def test_returns_dict(self):
        data = load_live_data()
        assert isinstance(data, dict)

    def test_has_gates_key(self):
        data = load_live_data()
        assert "gates" in data

    def test_gates_is_dict(self):
        data = load_live_data()
        assert isinstance(data["gates"], dict)

    def test_known_gates_present(self):
        data = load_live_data()
        for gate in ("Gate A", "Gate B", "Gate C", "Gate D"):
            assert gate in data["gates"], f"{gate} missing from live data"

    def test_alerts_is_list(self):
        data = load_live_data()
        assert isinstance(data.get("alerts", []), list)
