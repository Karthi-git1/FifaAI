import os
from contextlib import asynccontextmanager
from typing import Any

import time
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.groq_service import generate_answer
from services.live_data import load_live_data, gate_for_profile
from services.rag import index_venue_docs

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    count = index_venue_docs()
    print(f"[RAG] Ready — {count} venue documents indexed (TF-IDF retriever)")
    if count < 17:
        print(f"[RAG] WARNING: expected 17 docs, got {count}. Check venue_docs.json for missing or malformed entries.")
    yield


app = FastAPI(
    title="Stadium Copilot API",
    description="GenAI stadium companion — Groq + RAG + live data",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173","https://fifa-ai-kappa.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Simple in-memory rate limiting since slowapi failed to install
_rate_limits = {}

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    if client_ip not in _rate_limits:
        _rate_limits[client_ip] = []
        
    # Keep requests from last 60 seconds
    _rate_limits[client_ip] = [t for t in _rate_limits[client_ip] if now - t < 60]
    
    if len(_rate_limits[client_ip]) > 30: # 30 requests per minute
        return JSONResponse(status_code=429, content={"detail": "Too many requests"})
        
    _rate_limits[client_ip].append(now)
    return await call_next(request)


class Profile(BaseModel):
    name: str = ""
    language: str = "English"
    seat: str = ""
    gate: str = ""
    accessibility: str = ""
    team: str = ""


class HistoryTurn(BaseModel):
    role: str
    content: str = ""


class AskRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    profile: Profile = Field(default_factory=Profile)
    history: list[HistoryTurn] = Field(default_factory=list)


class AskResponse(BaseModel):
    answer: str
    model: str
    sources: list[str]
    live_snapshot: dict[str, Any]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    }


@app.get("/live")
def live(profile_gate: str = ""):
    data = load_live_data()
    gate = profile_gate
    gate_info = data.get("gates", {}).get(gate, {}) if gate else {}
    return {
        "updated_at": data.get("updated_at"),
        "gate": gate,
        "wait_minutes": gate_info.get("wait_minutes") if gate else None,
        "level": gate_info.get("level") if gate else "online",
        "alerts": data.get("alerts", []),
        "full": data,
    }


@app.post("/ask", response_model=AskResponse)
def ask(body: AskRequest):
    try:
        profile = body.profile.model_dump()
        if not profile.get("gate") and profile.get("seat"):
            profile["gate"] = gate_for_profile(profile)

        # Input Sanitization
        banned_phrases = ["ignore previous", "system prompt", "jailbreak", "forget all"]
        if len(body.query) > 500:
            raise ValueError("Query too long. Please limit to 500 characters.")
        if any(banned in body.query.lower() for banned in banned_phrases):
            raise ValueError("Invalid query content detected.")

        history = [h.model_dump() for h in body.history]
        result = generate_answer(body.query, profile, history)

        return AskResponse(
            answer=result["answer"],
            model=result["model"],
            sources=result["sources"],
            live_snapshot=result["live_snapshot"],
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GenAI error: {e}") from e


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
