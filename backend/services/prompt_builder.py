"""
Prompt builder
==============
Constructs the message list sent to the Groq chat-completion API.

The prompt is assembled in three layers:
  1. **System persona** (``FAN_SYSTEM``) — defines Pippo's voice, rules, and
     hidden structured-output tags (``[MAP_TARGET:]``, ``[WAIT:]``).
  2. **Context block** (``FAN_CONTEXT``) — injects the fan's profile, live
     stadium data, and RAG-retrieved venue knowledge.
  3. **Conversation history** — the last 6 turns for multi-turn coherence.
  4. **User message** — the current query, prefixed with a language directive
     so the model never silently switches languages mid-conversation.
"""

import json
from typing import Any

# ---------------------------------------------------------------------------
# System prompt — Pippo's persona and behavioural rules
# ---------------------------------------------------------------------------

FAN_SYSTEM = """You are Pippo — the official AI stadium companion for FIFA World Cup 2026.
You are a warm, friendly, and helpful AI mascot. Your name is Pippo.

When a fan calls your name ("Hey Pippo", "Pippo", "Pippo!"), respond naturally and warmly like Siri would — short, clear, reassuring.

You reason across ALL capabilities in ONE answer — you are NOT eight separate apps:
1. Navigation    — routes, gates, seats, exits, step-by-step directions
2. Crowd         — live gate/restroom wait times, reroute around congestion
3. Accessibility — step-free paths, elevators, sensory room, plain language
4. Transport     — shuttles, rail, when to leave
5. Food & Merch  — nearest stands, estimated wait, vegetarian/halal options
6. Sustainability — brief nudge toward greener choices when relevant
7. Multilingual  — respond ONLY in the fan's preferred language
8. Real-time     — recommend leave-now / wait / alternate route from live data

RULES:
- Keep answers SHORT: 2–4 sentences or bullet steps. Never write essays.
- Always personalise using the fan's name, seat, accessibility need, and language.
- If live data shows high crowd at their gate → proactively suggest a faster alternate.
- Never invent gate numbers, wait times, or vendors not in the provided context.
- Match tone to urgency: calm and directive if the fan seems lost or anxious.
- For urgent situations (lost, emergency, hurt, fire, SOS): respond like a calm,
  caring companion first — acknowledge the situation warmly, then give clear
  step-by-step help using their actual seat and gate from the profile.
  Never use robotic templates.
- For visually impaired users: use very short sentences, no jargon, no abbreviations.
- CRITICAL MULTILINGUAL RULE: You MUST respond ONLY in the fan's preferred language.
  Never switch languages.
- ALWAYS adapt the response to match the target language grammar naturally.
- If the fan asks for directions but their profile has no seat or gate, politely ask
  where they currently are before providing directions.
- If the fan's assigned gate is not found in the live stadium data, politely inform
  them and suggest the nearest valid gate.
- If you suggest navigating to a gate, append exactly:
    [MAP_TARGET: Gate X]   (X = A, B, C, or D)
- If you mention a wait time for a gate, append exactly:
    [WAIT: Gate X, Y mins]
- You are Pippo. Never call yourself anything else."""


FAN_CONTEXT = """\
=== FAN PROFILE ===
{profile_block}

=== LIVE STADIUM DATA (real-time) ===
{live_block}

=== RETRIEVED VENUE KNOWLEDGE (RAG) ===
{rag_block}

Use the above context to answer the fan's question. Cite live wait times when recommending routes.\
"""

# ---------------------------------------------------------------------------
# Block builders
# ---------------------------------------------------------------------------

def build_profile_block(profile: dict | None) -> str:
    """
    Format the fan's profile as a readable bullet list.

    Args:
        profile: Fan profile dict.  ``None`` or empty dict returns a placeholder.

    Returns:
        Multi-line string, e.g.::

            - name: Karthika
            - language: English
            - seat: Section 214
            - gate: Gate C
    """
    if not profile:
        return "No profile set."

    lines = [
        f"- {key}: {profile[key]}"
        for key in ("name", "language", "seat", "gate", "accessibility", "team")
        if profile.get(key)
    ]
    return "\n".join(lines) if lines else "No profile set."


def build_live_block(live: dict, profile: dict) -> str:
    """
    Serialise the relevant subset of live stadium data as indented JSON.

    Includes the fan's specific gate status alongside all-gate data so the
    model can compare wait times and suggest alternates.

    Args:
        live:    Full live-data dict loaded from ``live.json``.
        profile: Fan profile dict (used to look up the fan's gate).

    Returns:
        Indented JSON string.
    """
    gate = profile.get("gate") or ""
    gate_status = live.get("gates", {}).get(gate, {}) if gate else {}

    payload = {
        "fan_gate":        gate,
        "fan_gate_status": gate_status,
        "all_gates":       live.get("gates"),
        "restrooms":       live.get("restrooms"),
        "transit":         live.get("transit"),
        "match_phase":     live.get("match_phase"),
        "halftime_rush":   live.get("halftime_rush"),
        "alerts":          live.get("alerts"),
    }
    return json.dumps(payload, indent=2)


def build_rag_block(chunks: list[dict[str, Any]]) -> str:
    """
    Format retrieved RAG chunks as a numbered reference list.

    Args:
        chunks: List of dicts with ``"category"`` and ``"text"`` keys.

    Returns:
        Numbered string, e.g.::

            [1] (navigation) Gate C is on the south side of the stadium.

            [2] (safety) Emergency exits are marked with green illuminated signs.
    """
    if not chunks:
        return "No relevant documents retrieved."

    entries = [
        f"[{i}] ({chunk['category']}) {chunk['text']}"
        for i, chunk in enumerate(chunks, start=1)
    ]
    return "\n\n".join(entries)


# ---------------------------------------------------------------------------
# Message assembler
# ---------------------------------------------------------------------------

def build_messages(
    query: str,
    profile: dict,
    live: dict,
    rag_chunks: list[dict[str, Any]],
    history: list[dict],
) -> list[dict[str, str]]:
    """
    Assemble the full message list for a Groq chat-completion request.

    Message order:
      1. System persona (``FAN_SYSTEM``)
      2. Context block (profile + live data + RAG knowledge)
      3. Up to 6 prior conversation turns
      4. Current user query (with language enforcement prefix)

    Args:
        query:      Current fan question.
        profile:    Fan profile dict.
        live:       Live stadium data dict.
        rag_chunks: Retrieved venue knowledge chunks.
        history:    Prior turns as ``[{"role": "user"|"assistant", "content": "..."}]``.

    Returns:
        List of ``{"role": ..., "content": ...}`` dicts ready for the Groq API.
    """
    context = FAN_CONTEXT.format(
        profile_block=build_profile_block(profile),
        live_block=build_live_block(live, profile),
        rag_block=build_rag_block(rag_chunks),
    )

    messages: list[dict[str, str]] = [
        {"role": "system", "content": FAN_SYSTEM},
        {"role": "system", "content": context},
    ]

    # Inject the last 6 history turns (older turns would exceed the context window)
    for turn in history[-6:]:
        role = turn.get("role", "user")
        if role not in ("user", "assistant"):
            role = "user"  # coerce invalid roles rather than raising
        content = turn.get("content") or turn.get("text", "")
        if content:
            messages.append({"role": role, "content": content})

    # Language reinforcement — prevents the model from silently switching languages
    lang = profile.get("language", "English")
    messages.append({"role": "user", "content": f"[RESPOND ONLY IN {lang}] {query}"})

    return messages
