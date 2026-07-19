# Pippo — FIFA World Cup 2026 AI Stadium Companion 🏟️🤖

## Chosen Vertical: Stadium Fan Experience 🏆
Our solution focuses heavily on the holistic **Stadium Fan Experience**, ensuring fans can navigate smoothly, stay safe, and enjoy the game with zero friction.

### 🧠 Approach & Logic
Pippo leverages GenAI not just to answer questions, but to demonstrate **Logical Decision Making Based on User Context**:
1. **Context-Aware Routing:** Pippo dynamically recommends gates and routes based on live crowd heat maps (RAG + Live Data). If Gate C is busy, Pippo routes you to Gate B.
2. **Emergency SOS Protocol:** A dedicated safety pipeline that intercepts critical keywords ("help", "injured", "SOS") and immediately surfaces emergency medical and security infrastructure relative to the fan's location.
3. **Strict Multilingual Enforcement:** Using targeted prompt engineering, Pippo strictly adheres to the fan's chosen language, adapting grammar and tone perfectly.

### 🌟 Key Features (What Makes Pippo Unique)
- **Live Crowd SVG Heat Map:** Real-time visual representation of gate congestion dynamically colored by stadium data.
- **Progressive Web App (PWA):** Fans can install Pippo on their home screen for a native app feel.
- **Inclusive Accessibility:** Built-in Text-to-Speech (TTS), high-contrast modes, and simplified phrasing for visually impaired fans.
- **Performance Optimized:** Uses `lru_cache` on RAG retrievals and lightweight vector math to ensure instant GenAI responses.
- **Secure:** Includes API rate-limiting and prompt-injection sanitization to keep the AI safe in production.

### 🤔 Assumptions Made
- We assume fans will access this primarily via mobile devices, hence the PWA and mobile-first fixed viewport design.
- The `live.json` file mocks an external live IoT data stream that would exist in modern stadiums.
- We assume Groq is available for inference, prioritizing speed to mimic a live conversational AI.

---
*Built for the GenAI Next-Level Challenge.*
