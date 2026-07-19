"""
Groq LLM service
================
Wraps the Groq chat-completion API with:
  - Automatic model fallback when the primary model hits its daily token limit
  - Simple in-memory response cache for repeated identical queries
  - Friendly error messages surfaced to the caller on exhaustion
"""

import os
import re
from typing import Any

from groq import Groq

from services.live_data import gate_for_profile, load_live_data
from services.prompt_builder import build_messages
from services.rag import retrieve

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Default primary model — overridable via the GROQ_MODEL environment variable.
DEFAULT_MODEL = "llama-3.3-70b-versatile"

#: Fallback chain tried in order when the primary model returns HTTP 429.
#: Each model has its own independent daily token quota on the Groq free tier.
FALLBACK_MODELS: list[str] = [
    "llama-3.1-8b-instant",  # fast, low token cost
    "gemma2-9b-it",          # Google Gemma via Groq
    "llama3-8b-8192",        # Llama 3 8B
]

#: Maximum tokens to request per completion.
MAX_TOKENS = 512

#: LLM temperature — low value keeps answers factual and consistent.
TEMPERATURE = 0.4

# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------

#: Simple query → result cache.  Keyed on ``"{query}_{gate}"``.
#: Bypassed when the request includes conversation history.
_cache: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_client() -> Groq:
    """
    Create and return an authenticated Groq client.

    Raises:
        ValueError: If the ``GROQ_API_KEY`` environment variable is not set.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY not set. "
            "Copy backend/.env.example to backend/.env and add your key."
        )
    return Groq(api_key=api_key)


def _call_model(client: Groq, model: str, messages: list[dict], max_tokens: int) -> str:
    """
    Send a chat completion request and return the assistant's reply text.

    Args:
        client:     Authenticated Groq client.
        model:      Model identifier string.
        messages:   Formatted message list (system + history + user).
        max_tokens: Upper bound on response length.

    Returns:
        Stripped reply string.  Empty string if the model returns no content.

    Raises:
        Exception: Any Groq API error (caller decides whether to retry).
    """
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=TEMPERATURE,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


def _extract_wait_hint(error_message: str) -> str:
    """
    Parse the retry-after duration from a Groq 429 error string.

    Returns a human-readable hint such as ``" (resets in 31m28s)"``
    or an empty string if no duration is found.
    """
    match = re.search(r"Please try again in (\S+)\.", error_message)
    return f" (resets in {match.group(1)})" if match else ""


def _build_rate_limit_message(last_error: Exception) -> str:
    """Return a user-friendly message when all models are exhausted."""
    wait_hint = _extract_wait_hint(str(last_error))
    return (
        f"Pippo's AI brain has hit its daily message limit{wait_hint}. "
        "All backup models are also at their limit. "
        "Please try again in a little while — the limit resets every 24 hours."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_answer(
    query: str,
    profile: dict[str, str] | None = None,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """
    Generate a Pippo AI response for a fan query.

    Attempts the primary model first, then each fallback in ``FALLBACK_MODELS``
    if a 429 rate-limit error is encountered.  Results are cached for identical
    (query, gate) pairs when no conversation history is present.

    Args:
        query:   The fan's question (1–500 characters).
        profile: Fan profile dict with keys: name, language, seat, gate,
                 accessibility, team.
        history: Prior conversation turns as ``[{"role": ..., "content": ...}]``.

    Returns:
        Dict containing:
          - ``answer``        — LLM reply string
          - ``model``         — model that produced the answer
          - ``sources``       — list of RAG document IDs used
          - ``rag_preview``   — first 120 chars of each retrieved chunk
          - ``live_snapshot`` — current gate and alert data

    Raises:
        ValueError: When all models are rate-limited.
        Exception:  For non-rate-limit Groq errors (auth failure, etc.).
    """
    profile = profile or {}
    history = history or []

    # ── Cache lookup ──────────────────────────────────────────────────────
    cache_key = f"{query}_{profile.get('gate', '')}"
    if not history and cache_key in _cache:
        cached = dict(_cache[cache_key])
        live = load_live_data()
        cached["live_snapshot"] = {
            "gate": profile.get("gate", ""),
            "gates": live.get("gates"),
            "alerts": live.get("alerts", []),
        }
        return cached

    # ── Prepare context ───────────────────────────────────────────────────
    rag_chunks = retrieve(query, n_results=4)
    live = load_live_data()

    if not profile.get("gate") and profile.get("seat"):
        profile = {**profile, "gate": gate_for_profile(profile)}

    messages = build_messages(query, profile, live, rag_chunks, history)

    # ── Model selection ───────────────────────────────────────────────────
    primary = os.getenv("GROQ_MODEL", DEFAULT_MODEL)
    models_to_try = [primary] + [m for m in FALLBACK_MODELS if m != primary]

    # ── LLM call with fallback ────────────────────────────────────────────
    client = _get_client()
    answer = ""
    used_model = primary
    last_error: Exception | None = None

    for model in models_to_try:
        try:
            answer = _call_model(client, model, messages, MAX_TOKENS)
            used_model = model
            last_error = None
            break
        except Exception as exc:
            error_str = str(exc)
            if "429" in error_str or "rate_limit_exceeded" in error_str:
                print(f"[Groq] Rate limit reached on '{model}', trying next fallback…")
                last_error = exc
                continue
            raise  # Non-rate-limit errors bubble up immediately

    if last_error is not None:
        raise ValueError(_build_rate_limit_message(last_error))

    # ── Build and cache result ────────────────────────────────────────────
    result: dict[str, Any] = {
        "answer": answer.strip(),
        "model": used_model,
        "sources": [chunk["id"] for chunk in rag_chunks],
        "rag_preview": [chunk["text"][:120] + "…" for chunk in rag_chunks],
        "live_snapshot": {
            "gate": profile.get("gate", ""),
            "gates": live.get("gates"),
            "alerts": live.get("alerts", []),
        },
    }

    if not history:
        _cache[cache_key] = dict(result)

    return result
