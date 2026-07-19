import pytest
from unittest.mock import patch, MagicMock
from services.groq_service import generate_answer


def test_emergency_detection_sos():
    """Emergency queries should produce a helpful, location-aware response."""
    query = "help me, I think there is an emergency"
    profile = {"seat": "Block 102", "gate": "Gate A"}

    mock_response = MagicMock()
    mock_response.choices[0].message.content = (
        "Gate A first aid is on Level 1. Follow the green exit signs. "
        "Security staff are stationed at all gate concourses. [MAP_TARGET: Gate A]"
    )

    with patch("services.groq_service._get_client") as mock_client_fn:
        client = MagicMock()
        client.chat.completions.create.return_value = mock_response
        mock_client_fn.return_value = client

        result = generate_answer(query, profile=profile)

    assert isinstance(result["answer"], str)
    assert len(result["answer"]) > 0
    assert isinstance(result["sources"], list)
    assert isinstance(result["model"], str)


def test_emergency_detection_injury():
    """Injury queries should return a non-empty helpful response."""
    query = "someone got hurt badly"
    profile = {}

    mock_response = MagicMock()
    mock_response.choices[0].message.content = (
        "I'm so sorry. Please stay calm. The nearest first aid station is at Gate C Level 1."
    )

    with patch("services.groq_service._get_client") as mock_client_fn:
        client = MagicMock()
        client.chat.completions.create.return_value = mock_response
        mock_client_fn.return_value = client

        result = generate_answer(query, profile=profile)

    assert isinstance(result["answer"], str)
    assert len(result["answer"]) > 0
