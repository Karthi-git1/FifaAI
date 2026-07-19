import os

from groq import Groq

from services.prompt_builder import build_messages
from services.rag import retrieve
from services.live_data import load_live_data, gate_for_profile


def get_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set. Copy backend/.env.example to backend/.env")
    return Groq(api_key=api_key)


_cache: dict[str, dict] = {}

def generate_answer(
    query: str,
    profile: dict[str, str] | None = None,
    history: list[dict[str, str]] | None = None,
) -> dict:
    profile = profile or {}
    history = history or []

    # Simple cache to improve efficiency and reduce Groq API calls for repeated identical queries
    # Skip cache when there is conversation history (context changes the answer)
    cache_key = f"{query}_{profile.get('gate', '')}"
    if not history and cache_key in _cache:
        cached_result = dict(_cache[cache_key])
        live = load_live_data()
        cached_result["live_snapshot"] = {
            "gate": profile.get("gate", "Gate C"),
            "gates": live.get("gates"),
            "alerts": live.get("alerts", []),
        }
        return cached_result

    rag_chunks = retrieve(query, n_results=4)
    live = load_live_data()

    if not profile.get("gate") and profile.get("seat"):
        profile = {**profile, "gate": gate_for_profile(profile)}

    messages = build_messages(query, profile, live, rag_chunks, history)
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    client = get_client()
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        max_tokens=512,
    )

    answer = response.choices[0].message.content or ""

    result = {
        "answer": answer.strip(),
        "model": model,
        "sources": [c["id"] for c in rag_chunks],
        "rag_preview": [c["text"][:120] + "…" for c in rag_chunks],
        "live_snapshot": {
            "gate": profile.get("gate", "Gate C"),
            "gates": live.get("gates"),
            "alerts": live.get("alerts", []),
        },
    }

    if not history:
        _cache[cache_key] = dict(result)

    return result
