"""
Stadium Copilot API
===================
FastAPI backend for Pippo — the FIFA World Cup 2026 AI stadium companion.

Endpoints:
  GET  /health  — liveness check and configuration status
  GET  /live    — real-time gate crowd data and alerts
  POST /ask     — AI-powered fan query (Groq LLM + RAG + live data)

Security measures implemented:
  - CORS restricted to known frontend origins
  - Per-IP rate limiting (30 req / 60 s) with OPTIONS preflight bypass
  - Prompt-injection guard blocks known jailbreak phrases
  - Pydantic schema enforces query length (1–500 chars) before any processing
  - Security response headers added to every reply
"""

import os
import time
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.groq_service import generate_answer
from services.live_data import gate_for_profile, load_live_data
from services.rag import index_venue_docs

load_dotenv()

# ---------------------------------------------------------------------------
# Security constants
# ---------------------------------------------------------------------------

#: Phrases that indicate prompt-injection or jailbreak attempts.
#: Queries containing any of these are rejected before reaching the LLM.
BANNED_PHRASES: list[str] = [
    "ignore previous",
    "system prompt",
    "jailbreak",
    "forget all",
]

#: Emergency keywords that trigger a priority SOS response path.
#: When detected, the query is flagged so the LLM is primed for emergency tone.
EMERGENCY_KEYWORDS: list[str] = [
    "emergency", "help me", "sos", "injured", "hurt", "fire",
    "evacuate", "evacuation", "first aid", "security",
]

#: Allowed CORS origins — only the production frontend and local dev servers.
ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://fifa-ai-kappa.vercel.app",
]

#: Per-IP request timestamp store for the sliding-window rate limiter.
_rate_limits: dict[str, list[float]] = {}

# ---------------------------------------------------------------------------
# Security response headers added to every HTTP response
# ---------------------------------------------------------------------------

_SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store",
}


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Index venue documents on startup so the first request is never slow."""
    count = index_venue_docs()
    print(f"[RAG] Ready — {count} venue documents indexed (TF-IDF retriever)")
    if count < 17:
        print(
            f"[RAG] WARNING: expected ≥17 docs, got {count}. "
            "Check venue_docs.json for missing or malformed entries."
        )
    yield


# ---------------------------------------------------------------------------
# Application setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Stadium Copilot API",
    description="GenAI stadium companion — Groq + RAG + live data",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS must be registered BEFORE the rate-limit middleware.
# Browsers send an OPTIONS preflight before every cross-origin POST.
# If rate-limiting runs first it rejects that preflight before CORS headers
# are added, causing the browser to report an opaque "Failed to fetch" error.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Attach security headers to every response."""
    response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        response.headers[header] = value
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """
    Sliding-window rate limiter: 30 requests per IP per 60-second window.

    OPTIONS (CORS preflight) requests always pass through so browsers can
    complete the preflight handshake without consuming the caller's quota.
    """
    if request.method == "OPTIONS":
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Initialise bucket and evict timestamps outside the 60-second window
    bucket = _rate_limits.setdefault(client_ip, [])
    _rate_limits[client_ip] = [t for t in bucket if now - t < 60]

    if len(_rate_limits[client_ip]) >= 30:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please wait before sending more."},
        )

    _rate_limits[client_ip].append(now)
    return await call_next(request)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class Profile(BaseModel):
    """Fan profile captured during onboarding."""

    name: str = ""
    language: str = "English"
    seat: str = ""
    gate: str = ""
    accessibility: str = ""
    team: str = ""


class HistoryTurn(BaseModel):
    """A single turn in the conversation history sent by the client."""

    role: str
    content: str = ""


class AskRequest(BaseModel):
    """Payload for POST /ask."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Fan's question (1–500 characters)",
    )
    profile: Profile = Field(default_factory=Profile, description="Fan profile context")
    history: list[HistoryTurn] = Field(
        default_factory=list,
        description="Recent conversation turns for multi-turn context",
    )


class AskResponse(BaseModel):
    """Response shape for POST /ask."""

    answer: str
    model: str
    sources: list[str]
    live_snapshot: dict[str, Any]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_emergency_query(query: str) -> bool:
    """
    Return True if the query contains any emergency keyword.

    Used to annotate the request so ``generate_answer`` can prime the LLM
    for an emergency-first response tone.

    Args:
        query: Raw query string from the fan.

    Returns:
        ``True`` if any ``EMERGENCY_KEYWORDS`` entry appears in the query.
    """
    query_lower = query.lower()
    return any(kw in query_lower for kw in EMERGENCY_KEYWORDS)


def _contains_banned_phrase(query: str) -> bool:
    """
    Return True if the query contains a known prompt-injection phrase.

    Args:
        query: Raw query string from the fan.

    Returns:
        ``True`` if any ``BANNED_PHRASES`` entry appears in the query.
    """
    query_lower = query.lower()
    return any(phrase in query_lower for phrase in BANNED_PHRASES)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", summary="Liveness and configuration check")
def health() -> dict[str, Any]:
    """Return service status and confirm the Groq API key is present."""
    return {
        "status": "ok",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    }


@app.get("/live", summary="Real-time gate crowd data")
def live(profile_gate: str = "") -> dict[str, Any]:
    """
    Return live crowd levels, wait times, and stadium alerts.

    Args:
        profile_gate: Optional gate identifier (e.g. ``"Gate A"``).
                      When provided, gate-specific wait data is included.
    """
    data = load_live_data()
    gate_info = data.get("gates", {}).get(profile_gate, {}) if profile_gate else {}

    return {
        "updated_at": data.get("updated_at"),
        "gate": profile_gate,
        "wait_minutes": gate_info.get("wait_minutes") if profile_gate else None,
        "level": gate_info.get("level") if profile_gate else "online",
        "alerts": data.get("alerts", []),
        "full": data,
    }


@app.post("/ask", response_model=AskResponse, summary="AI-powered fan query")
def ask(body: AskRequest) -> AskResponse:
    """
    Answer a fan's question using Groq LLM, TF-IDF RAG, and live stadium data.

    Processing pipeline:
      1. Validate query length (enforced by Pydantic schema — 1–500 chars).
      2. Block prompt-injection phrases (returns HTTP 503).
      3. Detect emergency keywords and flag for priority SOS handling.
      4. Infer gate from seat when not explicitly provided.
      5. Call ``generate_answer`` with full context.

    Args:
        body: Validated ``AskRequest`` payload.

    Returns:
        ``AskResponse`` with the LLM answer, model used, RAG sources, and live snapshot.

    Raises:
        HTTPException 503: Prompt-injection detected or LLM rate-limit exhausted.
        HTTPException 500: Unexpected server-side error.
    """
    try:
        # ── Security: reject prompt-injection attempts ────────────────────
        if _contains_banned_phrase(body.query):
            raise ValueError("Invalid query content detected.")

        # ── Context enrichment ────────────────────────────────────────────
        profile = body.profile.model_dump()

        # Infer gate from seat when the fan hasn't set one explicitly
        if not profile.get("gate") and profile.get("seat"):
            profile["gate"] = gate_for_profile(profile)

        # Flag emergency queries so the LLM adopts an SOS-first tone
        if _is_emergency_query(body.query):
            profile["_emergency"] = "true"

        history = [h.model_dump() for h in body.history]
        result = generate_answer(body.query, profile, history)

        return AskResponse(
            answer=result["answer"],
            model=result["model"],
            sources=result["sources"],
            live_snapshot=result["live_snapshot"],
        )

    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GenAI error: {exc}") from exc


# ---------------------------------------------------------------------------
# Entry point (local development)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    # Railway injects a PORT env var (typically 8080). Fall back to 8000 locally.
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
