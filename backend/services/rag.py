import json
import math
import re
from pathlib import Path

import numpy as np

DOCS_PATH = Path(__file__).resolve().parent.parent / "data" / "venue_docs.json"

_docs: list[dict] = []
_vectors: np.ndarray | None = None
_vocab: dict[str, int] = {}
_idf: np.ndarray | None = None


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _load_docs() -> list[dict]:
    with open(DOCS_PATH, encoding="utf-8") as f:
        return json.load(f)


def index_venue_docs() -> int:
    """
    Build TF-IDF index from venue_docs.json.

    Always rebuilds from scratch — never skips on re-call.
    This guarantees that any new documents added to venue_docs.json
    (e.g. security-bagcheck, parking, weather-tips, wifi) are embedded
    and retrievable immediately on the next server start or explicit re-index.
    """
    global _docs, _vectors, _vocab, _idf

    raw = _load_docs()

    # Validate every doc has required fields — skip malformed entries with a warning
    _docs = []
    for entry in raw:
        if all(k in entry for k in ("id", "category", "text")) and entry["text"].strip():
            _docs.append(entry)
        else:
            print(f"[RAG] WARNING: skipping malformed doc entry: {entry.get('id', '<no id>')}")

    if not _docs:
        print("[RAG] ERROR: no valid documents found in venue_docs.json")
        return 0

    tokens_per_doc = [_tokenize(d["text"]) for d in _docs]

    # Build vocabulary over ALL docs (including any newly added ones)
    _vocab = {}
    for tokens in tokens_per_doc:
        for t in tokens:
            _vocab.setdefault(t, len(_vocab))

    n = len(_docs)
    vocab_size = len(_vocab)
    df = np.zeros(vocab_size)
    matrix = np.zeros((n, vocab_size))

    for i, tokens in enumerate(tokens_per_doc):
        tf: dict[str, int] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        for t, count in tf.items():
            j = _vocab[t]
            matrix[i, j] = count
            df[j] += 1

    # Smooth IDF so new/rare terms still get a useful weight
    _idf = np.log((n + 1) / (df + 1)) + 1
    _vectors = matrix * _idf

    # L2-normalise so cosine similarity = dot product
    norms = np.linalg.norm(_vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1
    _vectors = _vectors / norms

    indexed_ids = [d["id"] for d in _docs]
    print(f"[RAG] Indexed {n} docs: {indexed_ids}")
    return n


def _query_vector(query: str) -> np.ndarray:
    tokens = _tokenize(query)
    vec = np.zeros(len(_vocab))
    tf: dict[str, int] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1
    for t, count in tf.items():
        if t in _vocab:
            vec[_vocab[t]] = count * _idf[_vocab[t]]
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


# NOTE: No @lru_cache here.
# lru_cache would return stale results for repeated queries after a re-index
# (e.g. if index_venue_docs() is called again to pick up new docs).
# Query execution is fast (pure numpy dot product) — caching is not needed.
def retrieve(query: str, n_results: int = 4) -> list[dict]:
    global _docs, _vectors

    if _vectors is None or len(_docs) == 0:
        index_venue_docs()

    q = _query_vector(query)
    scores = _vectors @ q
    top_idx = np.argsort(scores)[::-1][:n_results]

    hits = []
    for i in top_idx:
        if scores[i] <= 0:
            continue
        d = _docs[i]
        hits.append({
            "id":       d["id"],
            "text":     d["text"],
            "category": d["category"],
            "score":    float(scores[i]),
        })

    # Fallback: return top-2 docs with score=0 so the prompt always has context
    if not hits:
        return [
            {"id": d["id"], "text": d["text"], "category": d["category"], "score": 0.0}
            for d in _docs[:2]
        ]

    return hits
