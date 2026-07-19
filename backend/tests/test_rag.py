import pytest
import numpy as np
from services.rag import index_venue_docs, retrieve, _tokenize, _query_vector


# ── Tokenizer ─────────────────────────────────────────────────────────────────

class TestTokenize:
    def test_basic_words(self):
        assert _tokenize("Gate A exit") == ["gate", "a", "exit"]

    def test_numbers_kept(self):
        assert "214" in _tokenize("Section 214 Row B")

    def test_punctuation_stripped(self):
        tokens = _tokenize("first-aid, restroom!")
        assert "," not in tokens
        assert "!" not in tokens

    def test_empty_string(self):
        assert _tokenize("") == []

    def test_uppercase_lowercased(self):
        assert _tokenize("EMERGENCY EXIT") == ["emergency", "exit"]


# ── Indexing ──────────────────────────────────────────────────────────────────

class TestIndexVenueDocs:
    def test_returns_positive_count(self):
        count = index_venue_docs()
        assert count > 0

    def test_returns_at_least_17_docs(self):
        # venue_docs.json should have 17+ documents
        count = index_venue_docs()
        assert count >= 17

    def test_repeated_index_same_count(self):
        # Calling twice should return same count (idempotent)
        c1 = index_venue_docs()
        c2 = index_venue_docs()
        assert c1 == c2


# ── Retrieval ─────────────────────────────────────────────────────────────────

class TestRetrieve:
    def setup_method(self):
        index_venue_docs()

    def test_returns_list(self):
        results = retrieve("nearest exit")
        assert isinstance(results, list)

    def test_returns_up_to_n_results(self):
        results = retrieve("food stand", n_results=3)
        assert len(results) <= 3

    def test_each_result_has_required_keys(self):
        results = retrieve("gate crowd wait")
        for r in results:
            assert "id" in r
            assert "text" in r
            assert "category" in r
            assert "score" in r

    def test_scores_are_floats(self):
        results = retrieve("accessible route wheelchair")
        for r in results:
            assert isinstance(r["score"], float)

    def test_emergency_query_retrieves_emergency_doc(self):
        results = retrieve("emergency SOS first aid")
        ids = [r["id"] for r in results]
        assert any("emergency" in doc_id for doc_id in ids), \
            f"Expected emergency doc in results, got: {ids}"

    def test_gate_query_retrieves_gate_doc(self):
        results = retrieve("Gate A entrance crowd level")
        ids = [r["id"] for r in results]
        assert any("gate" in doc_id for doc_id in ids), \
            f"Expected gate doc in results, got: {ids}"

    def test_empty_query_returns_fallback(self):
        # Empty query should never crash — returns fallback docs
        results = retrieve("")
        assert isinstance(results, list)

    def test_n_results_1(self):
        results = retrieve("parking shuttle", n_results=1)
        assert len(results) <= 1

    def test_irrelevant_query_still_returns_something(self):
        # Even a garbage query should get a fallback result
        results = retrieve("xyzzy foobar qwerty")
        assert isinstance(results, list)


# ── Query vector ──────────────────────────────────────────────────────────────

class TestQueryVector:
    def setup_method(self):
        index_venue_docs()

    def test_returns_numpy_array(self):
        vec = _query_vector("exit gate")
        assert isinstance(vec, np.ndarray)

    def test_zero_vector_for_unknown_words(self):
        vec = _query_vector("xyzzy_nonexistent_token_9999")
        assert np.all(vec == 0)
