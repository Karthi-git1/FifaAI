"""
TF-IDF Retrieval-Augmented Generation (RAG) engine
====================================================
Builds a lightweight TF-IDF index over ``data/venue_docs.json`` at startup
and exposes a ``retrieve`` function that returns the most relevant document
chunks for a given query.

Design decisions
----------------
- **No external vector DB** — pure NumPy keeps the dependency footprint small
  and the service self-contained.
- **Always rebuild on index_venue_docs()** — ensures newly added documents are
  picked up immediately without a cache-invalidation step.
- **No @lru_cache on retrieve** — the index may be rebuilt at runtime; caching
  the query results would return stale data after a re-index.
"""

import json
import re
from pathlib import Path
from typing import Any

import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Absolute path to the venue knowledge base, resolved relative to this module.
DOCS_PATH = Path(__file__).resolve().parent.parent / "data" / "venue_docs.json"

#: Required fields for a document entry to be considered valid.
_REQUIRED_DOC_FIELDS = ("id", "category", "text")

# ---------------------------------------------------------------------------
# Module-level index state
# ---------------------------------------------------------------------------

_docs: list[dict[str, Any]] = []
_vocab: dict[str, int] = {}
_idf: np.ndarray | None = None
_vectors: np.ndarray | None = None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    """
    Lowercase and split ``text`` into alphanumeric tokens.

    Punctuation and whitespace are discarded.

    Args:
        text: Raw input string.

    Returns:
        List of lowercase token strings.

    Examples:
        >>> _tokenize("Gate A — Exit!")
        ['gate', 'a', 'exit']
    """
    return re.findall(r"[a-z0-9]+", text.lower())


def _load_raw_docs() -> list[dict[str, Any]]:
    """Read and return the raw JSON document list from ``DOCS_PATH``."""
    with open(DOCS_PATH, encoding="utf-8") as f:
        return json.load(f)


def _validate_docs(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Filter out malformed entries and warn about them.

    A valid document must have non-empty ``id``, ``category``, and ``text``
    fields.  Malformed entries are skipped with a console warning so that one
    bad record never silently breaks the entire index.

    Args:
        raw: Unvalidated document list from the JSON file.

    Returns:
        List of valid document dicts.
    """
    valid = []
    for entry in raw:
        has_fields = all(k in entry for k in _REQUIRED_DOC_FIELDS)
        has_text = has_fields and entry["text"].strip()
        if has_text:
            valid.append(entry)
        else:
            doc_id = entry.get("id", "<no id>")
            print(f"[RAG] WARNING: skipping malformed doc '{doc_id}'")
    return valid


def _build_tfidf_matrix(
    docs: list[dict[str, Any]],
) -> tuple[dict[str, int], np.ndarray, np.ndarray]:
    """
    Build a smoothed TF-IDF matrix from a list of validated documents.

    Uses log-smoothed IDF so that rare terms receive a proportionally higher
    weight without dominating the similarity scores.

    Args:
        docs: Validated document list (each must have a ``"text"`` field).

    Returns:
        Tuple of:
          - ``vocab``   — token → column-index mapping
          - ``idf``     — per-term IDF weight vector (shape: vocab_size,)
          - ``vectors`` — L2-normalised TF-IDF matrix (shape: n_docs × vocab_size)
    """
    tokens_per_doc = [_tokenize(d["text"]) for d in docs]
    n = len(docs)

    # Build global vocabulary
    vocab: dict[str, int] = {}
    for tokens in tokens_per_doc:
        for token in tokens:
            vocab.setdefault(token, len(vocab))

    vocab_size = len(vocab)
    df = np.zeros(vocab_size)
    matrix = np.zeros((n, vocab_size))

    for i, tokens in enumerate(tokens_per_doc):
        # Count term frequencies for this document
        tf: dict[str, int] = {}
        for token in tokens:
            tf[token] = tf.get(token, 0) + 1
        # Populate the TF matrix and document-frequency vector
        for token, count in tf.items():
            col = vocab[token]
            matrix[i, col] = count
            df[col] += 1

    # Smooth IDF: log((N+1) / (df+1)) + 1  — avoids zero weights for rare terms
    idf = np.log((n + 1) / (df + 1)) + 1
    vectors = matrix * idf

    # L2-normalise so cosine similarity reduces to a dot product at query time
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1
    vectors = vectors / norms

    return vocab, idf, vectors


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def index_venue_docs() -> int:
    """
    Build (or rebuild) the TF-IDF index from ``venue_docs.json``.

    Always performs a full rebuild so that any documents added to the JSON
    file are picked up on the next server start without manual intervention.

    Returns:
        Number of successfully indexed documents.
    """
    global _docs, _vocab, _idf, _vectors  # noqa: PLW0603

    raw = _load_raw_docs()
    _docs = _validate_docs(raw)

    if not _docs:
        print("[RAG] ERROR: no valid documents found in venue_docs.json")
        return 0

    _vocab, _idf, _vectors = _build_tfidf_matrix(_docs)

    doc_ids = [d["id"] for d in _docs]
    print(f"[RAG] Indexed {len(_docs)} docs: {doc_ids}")
    return len(_docs)


def _query_vector(query: str) -> np.ndarray:
    """
    Convert a query string into a TF-IDF vector aligned with the current index.

    Tokens absent from the vocabulary contribute zero weight.
    The resulting vector is L2-normalised so dot-product scores equal cosine
    similarities against the normalised document vectors.

    Args:
        query: Raw query string from the fan.

    Returns:
        Normalised query vector (shape: vocab_size,).
    """
    tokens = _tokenize(query)
    vec = np.zeros(len(_vocab))

    tf: dict[str, int] = {}
    for token in tokens:
        tf[token] = tf.get(token, 0) + 1

    for token, count in tf.items():
        if token in _vocab:
            vec[_vocab[token]] = count * _idf[_vocab[token]]

    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def retrieve(query: str, n_results: int = 4) -> list[dict[str, Any]]:
    """
    Return the top-``n_results`` venue documents most relevant to ``query``.

    Lazily rebuilds the index if it has not been initialised yet.
    Documents with a cosine similarity of zero are excluded from results.
    If no document scores above zero a two-document fallback is returned so
    the LLM always receives some context.

    Args:
        query:     Fan's question string.
        n_results: Maximum number of documents to return.

    Returns:
        List of dicts, each containing:
          - ``id``       — document identifier
          - ``text``     — full document text
          - ``category`` — document category label
          - ``score``    — cosine similarity score (float)
    """
    global _docs, _vectors  # noqa: PLW0603

    if _vectors is None or not _docs:
        index_venue_docs()

    q = _query_vector(query)
    scores = _vectors @ q
    top_indices = np.argsort(scores)[::-1][:n_results]

    hits = [
        {
            "id":       _docs[i]["id"],
            "text":     _docs[i]["text"],
            "category": _docs[i]["category"],
            "score":    float(scores[i]),
        }
        for i in top_indices
        if scores[i] > 0
    ]

    if not hits:
        # Fallback: always give the LLM at least two documents for context
        return [
            {
                "id":       d["id"],
                "text":     d["text"],
                "category": d["category"],
                "score":    0.0,
            }
            for d in _docs[:2]
        ]

    return hits
