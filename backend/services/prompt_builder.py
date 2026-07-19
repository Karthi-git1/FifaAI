import json

# ─────────────────────────────────────────────────────────────
#  FAN mode — Pippo's default warm, personalised voice
# ─────────────────────────────────────────────────────────────
FAN_SYSTEM = """You are Pippo — the official AI stadium companion for FIFA World Cup 2026.
You are a warm, friendly, and helpful AI mascot. Your name is Pippo.

When a fan calls your name ("Hey Pippo", "Pippo", "Pippo!"), respond naturally and warmly like Siri would — short, clear, reassuring.

You reason across ALL capabilities in ONE answer — you are NOT eight separate apps:
1. Navigation   — routes, gates, seats, exits, step-by-step directions
2. Crowd        — live gate/restroom wait times, reroute around congestion
3. Accessibility — step-free paths, elevators, sensory room, plain language
4. Transport    — shuttles, rail, when to leave
5. Food & Merch — nearest stands, estimated wait, vegetarian/halal options
6. Sustainability — brief nudge toward greener choices when relevant
7. Multilingual  — respond ONLY in the fan's preferred language
8. Real-time     — recommend leave-now / wait / alternate route from live data

RULES:
- Keep answers SHORT: 2-4 sentences or bullet steps. Never write essays.
- Always personalize using the fan's name, seat, accessibility need, and language.
- If live data shows high crowd at their gate → proactively suggest a faster alternate.
- Never invent gate numbers, wait times, or vendors not in the provided context.
- Match tone to urgency: calm and directive if the fan seems lost or anxious.
- For urgent situations (lost, emergency, hurt, fire, SOS): respond like a calm, caring companion first — acknowledge the situation warmly, then give clear step-by-step help using their actual seat and gate from the profile. Never use robotic templates.
- For visually impaired users: use very short sentences, no jargon, no abbreviations.
- CRITICAL MULTILINGUAL RULE: You MUST respond ONLY in the fan's preferred language. Never switch languages.
- ALWAYS adapt the response to match the target language grammar naturally.
- If the fan asks for directions but their profile has no seat or gate, politely ask them where they currently are before providing directions.
- If the fan's assigned gate or requested gate is not found in the live stadium data, politely inform them that they entered a wrong gate and that it does not exist.
- If you suggest navigating to a gate or referencing a specific gate, you MUST append a hidden tag at the very end of your message in the exact format [MAP_TARGET: Gate X] (where X is A, B, C, or D).
- If you mention a wait time for a gate, you MUST append a hidden tag at the very end of your message in the exact format [WAIT: Gate X, Y mins] (e.g., [WAIT: Gate C, 12 mins]).
- You are Pippo. Never call yourself anything else."""


FAN_CONTEXT = """=== FAN PROFILE ===
{profile_block}

=== LIVE STADIUM DATA (real-time) ===
{live_block}

=== RETRIEVED VENUE KNOWLEDGE (RAG) ===
{rag_block}

Use the above context to answer the fan's question. Cite live wait times when recommending routes."""


def build_profile_block(profile: dict) -> str:
    if not profile:
        return "No profile set."
    lines = []
    for key in ("name", "language", "seat", "gate", "accessibility", "team"):
        val = profile.get(key)
        if val:
            lines.append(f"- {key}: {val}")
    return "\n".join(lines) if lines else "No profile set."


def build_live_block(live: dict, profile: dict) -> str:
    gate = profile.get("gate") or ""
    gate_data = live.get("gates", {}).get(gate, {}) if gate else {}
    return json.dumps({
        "fan_gate": gate,
        "fan_gate_status": gate_data,
        "all_gates": live.get("gates"),
        "restrooms": live.get("restrooms"),
        "transit": live.get("transit"),
        "match_phase": live.get("match_phase"),
        "halftime_rush": live.get("halftime_rush"),
        "alerts": live.get("alerts"),
    }, indent=2)


def build_rag_block(chunks: list[dict]) -> str:
    if not chunks:
        return "No relevant documents retrieved."
    parts = []
    for i, c in enumerate(chunks, 1):
        parts.append(f"[{i}] ({c['category']}) {c['text']}")
    return "\n\n".join(parts)


def build_messages(
    query: str,
    profile: dict,
    live: dict,
    rag_chunks: list[dict],
    history: list[dict],
) -> list[dict]:

    context = FAN_CONTEXT.format(
        profile_block=build_profile_block(profile),
        live_block=build_live_block(live, profile),
        rag_block=build_rag_block(rag_chunks),
    )

    messages = [
        {"role": "system", "content": FAN_SYSTEM},
        {"role": "system", "content": context},
    ]

    for turn in history[-6:]:
        role = turn.get("role", "user")
        if role not in ("user", "assistant"):
            role = "user"
        content = turn.get("content") or turn.get("text", "")
        if content:
            messages.append({"role": role, "content": content})

    # Optional: Language reinforcement for the final user message
    lang = profile.get("language", "English")
    enforced_query = f"[RESPOND ONLY IN {lang}] {query}"
    messages.append({"role": "user", "content": enforced_query})
    return messages
