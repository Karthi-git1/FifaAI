# Pippo — FIFA World Cup 2026 AI Stadium Companion 🏟️🤖

## Chosen Vertical: Stadium Fan Experience 🏆

Our solution focuses on the holistic **Stadium Fan Experience** — ensuring fans can navigate smoothly, stay safe, and enjoy the game with zero friction regardless of language, ability, or familiarity with the venue.

---

### 🧠 Approach & Logic

Pippo leverages GenAI not just to answer questions, but to demonstrate **Logical Decision Making Based on User Context**:

1. **Context-Aware Routing**
   Pippo dynamically recommends gates and routes based on live crowd data (RAG + Live JSON feed). If Gate C is congested, Pippo proactively routes the fan to Gate B — without being asked.

2. **Emergency SOS Detection**
   A keyword-interception layer in the API scans every query for emergency signals (`"help"`, `"injured"`, `"SOS"`, `"fire"`, `"evacuate"`, etc.). When triggered, the fan profile is flagged and the LLM is primed to respond in an emergency-first, calm, step-by-step tone using the fan's actual seat and gate data.

3. **Strict Multilingual Enforcement**
   Using targeted prompt engineering, Pippo strictly adheres to the fan's chosen language (17 languages supported), adapting grammar and tone — never switching mid-conversation.

4. **Conversation Memory**
   The last 6 conversation turns are passed to the LLM on every request, enabling coherent multi-turn dialogue without a database.

---

### 🌟 Key Features

| Feature | Description |
|---------|-------------|
| **Live Crowd SVG Heat Map** | Real-time gate congestion visualised as a colour-coded stadium diagram, updated from live data every 20 seconds |
| **Progressive Web App (PWA)** | Installable on the home screen for a native-app experience on iOS and Android |
| **Voice Interface** | Wake-word detection ("Hey Pippo"), real-time speech-to-text, and Text-to-Speech responses |
| **Inclusive Accessibility** | TTS, high-contrast mode, simplified phrasing for visually impaired fans; WCAG-considered layout |
| **Multilingual Support** | 17 languages with strict enforcement — the AI never silently switches languages |
| **Emergency SOS Button** | One-tap emergency escalation that surfaces the nearest exit, first aid station, and security contact |
| **Response Caching** | Identical (query, gate) pairs served from an in-memory cache to reduce LLM calls and latency |
| **Model Fallback Chain** | If the primary Groq model hits its rate limit, the system automatically retries with three backup models |

---

### 🔒 Security

- **Rate limiting** — 30 requests per IP per 60-second sliding window; OPTIONS preflight bypassed to preserve CORS flow
- **Prompt-injection guard** — known jailbreak phrases (`"ignore previous"`, `"system prompt"`, `"jailbreak"`, `"forget all"`) are blocked before reaching the LLM
- **Security response headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control` set on every response
- **CORS allowlist** — only the production Vercel frontend and local dev origins are permitted
- **Input validation** — Pydantic enforces query length (1–500 characters) at the schema level before any business logic runs

---

### 🤔 Assumptions Made

- Fans access Pippo primarily on mobile devices — hence the PWA, safe-area-aware layout, and dynamic viewport height (`100dvh`).
- `live.json` mocks an external IoT crowd-sensor data stream that would exist in a real smart stadium deployment.
- Groq is available for inference; the fallback model chain ensures continuity if any single model is rate-limited.
- Gate assignment is inferred automatically from the fan's seat number — fans should not need to know their gate in advance.

---

*Built for the GenAI Next-Level Challenge.*
