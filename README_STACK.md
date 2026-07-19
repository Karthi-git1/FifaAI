# Pippo — Technical Stack & Setup ⚙️

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Frontend (Vite)                  │
│  PWA · Voice Input · TTS · Live SVG Map · Multi-lang    │
└────────────────────────┬────────────────────────────────┘
                         │  HTTPS  (fetch)
┌────────────────────────▼────────────────────────────────┐
│               FastAPI Backend (Python)                  │
│  /health  /live  /ask                                   │
│  CORS · Rate Limiting · Prompt-Injection Guard          │
│  Security Headers · Pydantic Validation                 │
└──────┬──────────────────┬───────────────────────────────┘
       │                  │
┌──────▼──────┐    ┌──────▼──────────────────────────────┐
│  live.json  │    │          Groq LLM API                │
│ (mock IoT   │    │  llama-3.3-70b-versatile (primary)   │
│  data feed) │    │  + 3 automatic fallback models       │
└─────────────┘    └──────┬───────────────────────────────┘
                          │
               ┌──────────▼──────────────┐
               │   TF-IDF RAG Engine     │
               │  venue_docs.json        │
               │  18 indexed documents   │
               │  pure NumPy — no DB     │
               └─────────────────────────┘
```

### 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + Vite | Fast builds, PWA support, no unnecessary dependencies |
| Styling | Inline styles + CSS-in-JS | Zero runtime CSS overhead, theme tokens in `theme.js` |
| State | React hooks + `localStorage` | No Redux needed for this scope |
| Backend | FastAPI + Pydantic | Async, auto-docs, schema validation at the boundary |
| AI | Groq API | Sub-second inference; fastest available LLM API |
| RAG | Custom TF-IDF (NumPy) | Self-contained, no vector DB dependency, fast enough for 18 docs |
| Deployment | Vercel (FE) + Railway (BE) | Free tier, auto-deploy from Git |

---

### ⚙️ How It Works

1. Fan submits a prompt (text or voice via Web Speech API).
2. Frontend sends `POST /ask` with the query, fan profile, and last 6 history turns.
3. Backend validates input (Pydantic), blocks injection phrases, detects emergency keywords.
4. If emergency detected → fan profile is flagged; LLM is primed for SOS-first tone.
5. Backend queries the TF-IDF index for the 4 most relevant venue knowledge chunks.
6. Backend loads current live stadium data (crowd levels, wait times, alerts).
7. Groq processes system persona + context + history + query and returns a response.
8. If the primary model is rate-limited, the system retries with up to 3 backup models.
9. Frontend parses hidden AI tags (`[MAP_TARGET: Gate A]`, `[WAIT: Gate C, 5 mins]`) to update the live stadium map and wait-time widgets.

---

### 🚀 How to Run Locally

**1. Clone the repository**
```bash
git clone <your-repo-link>
cd football
```

**2. Start the backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env           # then edit .env and add your GROQ_API_KEY
python -m uvicorn main:app --reload
```
Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

**3. Start the frontend**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`.

**4. Run the test suite**
```bash
cd backend
pytest tests/ -v
```
96 tests covering the RAG engine, prompt builder, Groq service (with mock), all API endpoints, input sanitisation, CORS, and the model fallback chain.

---

### 🌐 Production Deployment

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://fifa-ai-kappa.vercel.app |
| Backend (Railway) | https://fifaai-production.up.railway.app |

The frontend resolves the backend URL at build time via `import.meta.env.VITE_API_URL`, falling back to the Railway production URL when not set.

---

*Built for the GenAI Next-Level Challenge.*
