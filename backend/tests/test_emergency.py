import pytest
from services.groq_service import generate_answer

def test_emergency_detection_sos():
    # Test that providing an emergency keyword overrides normal flow and returns the SOS protocol
    query = "help me, I think there is an emergency"
    profile = {"seat": "Block 102", "gate": "Gate A"}
    
    result = generate_answer(query, profile=profile)
    
    assert "EMERGENCY MODE ACTIVATED" in result["answer"]
    assert "Gate A" in result["answer"]
    assert "rule-based-emergency" == result["model"]
    assert "SOS Protocol" in result["sources"]

def test_emergency_detection_injury():
    query = "someone got hurt badly"
    profile = {}
    
    result = generate_answer(query, profile=profile)
    assert "EMERGENCY MODE ACTIVATED" in result["answer"]
