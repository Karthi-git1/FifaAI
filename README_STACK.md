# Pippo — Technical Stack & Setup ⚙️

### 🏗️ Architecture
- **Frontend:** React (Vite) + Context API for state management.
- **Backend:** FastAPI for asynchronous endpoints (`/live`, `/ask`).
- **AI Core:** Groq API (`llama-3.3-70b-versatile`) for blazing-fast inference.
- **Knowledge Base (RAG):** Custom TF-IDF vector retrieval loaded with static stadium blueprints.

### ⚙️ How it Works
1. Fan submits a prompt (text or voice).
2. Backend intercepts the query. If it's an emergency, the SOS protocol immediately fires.
3. Otherwise, the backend fetches *Live Stadium Data* (crowd levels) + *RAG Context* (stadium map docs).
4. Groq processes the context, fan profile, and chat history to generate a short, personalized response in the fan's chosen language.
5. The frontend parses hidden AI tags (e.g., `[MAP_TARGET: Gate A]`) to highlight the interactive heat map dynamically.

### 🛠️ How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone <your-repo-link>
   cd football
   ```

2. **Start the Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Add your GROQ API KEY
   cp .env.example .env 
   # Edit .env with your GROQ_API_KEY
   
   python -m uvicorn main:app --reload
   ```

3. **Start the Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Run Tests:**
   ```bash
   cd backend
   pytest tests/
   ```
