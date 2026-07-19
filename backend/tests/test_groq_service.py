"""
Tests for groq_service — focuses on fallback logic, caching,
and error handling without making real Groq API calls.
"""
import pytest
from unittest.mock import patch, MagicMock, call
from services import groq_service
from services.groq_service import generate_answer


def _make_mock_response(text: str):
    """Build a minimal Groq-shaped response mock."""
    choice = MagicMock()
    choice.message.content = text
    response = MagicMock()
    response.choices = [choice]
    return response


def _groq_429_error():
    """Simulate a Groq 429 rate-limit exception."""
    err = Exception(
        "Error code: 429 - rate_limit_exceeded. Please try again in 5m0s."
    )
    return err


# ── Basic answer generation ───────────────────────────────────────────────────

class TestGenerateAnswer:
    def test_returns_dict_with_required_keys(self):
        mock_resp = _make_mock_response("Gate A is to the north.")
        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.return_value = mock_resp
            mock_client_fn.return_value = client

            result = generate_answer("Where is Gate A?", {}, [])

        assert "answer" in result
        assert "model" in result
        assert "sources" in result
        assert "live_snapshot" in result

    def test_answer_is_stripped_string(self):
        mock_resp = _make_mock_response("  Gate A is north.  ")
        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.return_value = mock_resp
            mock_client_fn.return_value = client

            result = generate_answer("gate question", {}, [])

        assert result["answer"] == "Gate A is north."

    def test_sources_are_list(self):
        mock_resp = _make_mock_response("Here is your answer.")
        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.return_value = mock_resp
            mock_client_fn.return_value = client

            result = generate_answer("food stand", {}, [])

        assert isinstance(result["sources"], list)


# ── Caching ───────────────────────────────────────────────────────────────────

class TestCaching:
    def setup_method(self):
        # Clear cache before each test
        groq_service._cache.clear()

    def test_same_query_no_history_uses_cache(self):
        mock_resp = _make_mock_response("Cached answer.")
        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.return_value = mock_resp
            mock_client_fn.return_value = client

            generate_answer("find my seat", {"gate": "Gate A"}, [])
            generate_answer("find my seat", {"gate": "Gate A"}, [])

            # Should only call the API once
            assert client.chat.completions.create.call_count == 1

    def test_query_with_history_bypasses_cache(self):
        mock_resp = _make_mock_response("Answer with history.")
        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.return_value = mock_resp
            mock_client_fn.return_value = client

            history = [{"role": "user", "content": "hello"}]
            generate_answer("find my seat", {"gate": "Gate A"}, history)
            generate_answer("find my seat", {"gate": "Gate A"}, history)

            # History present → no caching → 2 API calls
            assert client.chat.completions.create.call_count == 2

    def test_different_gates_different_cache_keys(self):
        mock_resp = _make_mock_response("Answer.")
        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.return_value = mock_resp
            mock_client_fn.return_value = client

            generate_answer("nearest exit", {"gate": "Gate A"}, [])
            generate_answer("nearest exit", {"gate": "Gate B"}, [])

            # Different gate → different cache key → 2 API calls
            assert client.chat.completions.create.call_count == 2


# ── Fallback model chain ──────────────────────────────────────────────────────

class TestFallbackChain:
    def setup_method(self):
        groq_service._cache.clear()

    def test_falls_back_to_second_model_on_429(self):
        success_resp = _make_mock_response("Fallback answer.")

        def side_effect(**kwargs):
            if kwargs.get("model") == "llama-3.3-70b-versatile":
                raise _groq_429_error()
            return success_resp

        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.side_effect = side_effect
            mock_client_fn.return_value = client

            result = generate_answer("test query", {}, [])

        assert result["answer"] == "Fallback answer."
        assert result["model"] != "llama-3.3-70b-versatile"

    def test_raises_friendly_error_when_all_models_exhausted(self):
        def side_effect(**kwargs):
            raise _groq_429_error()

        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.side_effect = side_effect
            mock_client_fn.return_value = client

            with pytest.raises(ValueError) as exc_info:
                generate_answer("any query", {}, [])

        assert "limit" in str(exc_info.value).lower()

    def test_non_429_error_raises_immediately(self):
        """A non-rate-limit error should propagate immediately without retrying."""
        with patch.object(groq_service, "_get_client") as mock_client_fn:
            client = MagicMock()
            client.chat.completions.create.side_effect = Exception("Auth error: invalid API key")
            mock_client_fn.return_value = client

            with pytest.raises(Exception) as exc_info:
                generate_answer("any query", {}, [])

        assert "Auth error" in str(exc_info.value)
        # Should only be called once (no retry on non-429)
        assert client.chat.completions.create.call_count == 1


# ── Missing API key ───────────────────────────────────────────────────────────

class TestMissingApiKey:
    def test_raises_value_error_when_key_missing(self, monkeypatch):
        monkeypatch.delenv("GROQ_API_KEY", raising=False)
        with pytest.raises(ValueError, match="GROQ_API_KEY"):
            generate_answer("hello", {}, [])
