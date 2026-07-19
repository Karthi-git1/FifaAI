"""
services package
================
Business-logic layer for the Stadium Copilot API.

Modules:
  - ``groq_service``   — Groq LLM client with fallback chain and response cache
  - ``live_data``      — Live stadium data loader and gate-inference helper
  - ``prompt_builder`` — Prompt assembly for Groq chat-completion requests
  - ``rag``            — TF-IDF retrieval-augmented generation engine
"""
