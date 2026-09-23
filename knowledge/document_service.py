"""
Personal knowledge library.

Retrieval strategy: keyword-overlap scoring over stored chunks, same
approach as memory_service. This works fully offline with zero extra
dependencies. To upgrade to true RAG with embeddings:
  1. pull an embedding model in Ollama (e.g. `ollama pull nomic-embed-text`)
  2. store a vector alongside each chunk (add a BLOB/JSON column)
  3. replace search_chunks() below with a cosine-similarity search
     using ai/ollama_client.embed()
That swap is isolated to this file and get_relevant_chunks().
"""
import os
import re
from pathlib import Path
from datetime import datetime, timezone

from config import config
from memory.database import cursor, rows_to_list

_WORD_RE = re.compile(r"[a-zA-Z0-9]+")


def _stem(word):
    """Very light suffix stripping so 'Arduinos' matches 'Arduino', etc."""
    for suffix in ("ing", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def _words(text):
    return set(_stem(w.lower()) for w in _WORD_RE.findall(text or "") if len(w) > 2)


def _chunk_text(text, size=None):
    size = size or config.KNOWLEDGE_CHUNK_SIZE_CHARS
    text = text.strip()
    if not text:
        return []
    return [text[i:i + size] for i in range(0, len(text), size)]


def _extract_text(filepath: Path):
    ext = filepath.suffix.lower()
    if ext in (".txt", ".md"):
        return filepath.read_text(encoding="utf-8", errors="ignore")
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            raise RuntimeError(
                "pypdf is not installed. Run: pip install pypdf --break-system-packages "
                "(or without that flag inside a virtualenv)."
            )
        reader = PdfReader(str(filepath))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    raise ValueError(f"Unsupported file type: {ext}")


def save_upload(filepath: Path, title=None, tags=None):
    """Extract, chunk, and index an uploaded document. Returns document id."""
    text = _extract_text(filepath)
    doc_title = title or filepath.stem
    with cursor() as cur:
        cur.execute(
            """INSERT INTO knowledge_documents (title, source_type, source_url, retrieved_at, tags, indexed)
               VALUES (?, 'upload', NULL, ?, ?, 1)""",
            (doc_title, datetime.now(timezone.utc).isoformat(), tags or ""),
        )
        doc_id = cur.lastrowid
        for i, chunk in enumerate(_chunk_text(text)):
            cur.execute(
                "INSERT INTO knowledge_chunks (document_id, chunk_index, content) VALUES (?,?,?)",
                (doc_id, i, chunk),
            )
    return doc_id


def save_research_document(title, url, content, retrieved_at=None, tags="research"):
    with cursor() as cur:
        cur.execute(
            """INSERT INTO knowledge_documents (title, source_type, source_url, retrieved_at, tags, indexed)
               VALUES (?, 'research', ?, ?, ?, 1)""",
            (title, url, retrieved_at or datetime.now(timezone.utc).isoformat(), tags),
        )
        doc_id = cur.lastrowid
        for i, chunk in enumerate(_chunk_text(content)):
            cur.execute(
                "INSERT INTO knowledge_chunks (document_id, chunk_index, content) VALUES (?,?,?)",
                (doc_id, i, chunk),
            )
    return doc_id


def list_documents():
    with cursor() as cur:
        cur.execute("SELECT * FROM knowledge_documents ORDER BY created_at DESC")
        return rows_to_list(cur.fetchall())


def get_document(doc_id):
    with cursor() as cur:
        cur.execute("SELECT * FROM knowledge_documents WHERE id=?", (doc_id,))
        doc = cur.fetchone()
        if not doc:
            return None
        cur.execute("SELECT * FROM knowledge_chunks WHERE document_id=? ORDER BY chunk_index", (doc_id,))
        chunks = rows_to_list(cur.fetchall())
        result = dict(doc)
        result["chunks"] = chunks
        return result


def delete_document(doc_id):
    with cursor() as cur:
        cur.execute("DELETE FROM knowledge_documents WHERE id=?", (doc_id,))
        return cur.rowcount > 0


def search_chunks(query, limit=10):
    q_words = _words(query)
    if not q_words:
        return []
    with cursor() as cur:
        cur.execute(
            """SELECT kc.*, kd.title as doc_title, kd.source_url
               FROM knowledge_chunks kc JOIN knowledge_documents kd ON kc.document_id = kd.id"""
        )
        rows = rows_to_list(cur.fetchall())
    scored = []
    for r in rows:
        overlap = len(q_words & _words(r["content"]))
        if overlap:
            scored.append((overlap, r))
    scored.sort(key=lambda t: t[0], reverse=True)
    results = []
    for _, r in scored[:limit]:
        results.append({"title": r["doc_title"], "url": r["source_url"], "content": r["content"]})
    return results


def get_relevant_chunks(query, limit=None):
    limit = limit or config.MAX_KNOWLEDGE_CHUNKS_IN_CONTEXT
    return search_chunks(query, limit=limit)


def validate_upload(filename, size_bytes):
    ext = Path(filename).suffix.lower()
    if ext not in config.ALLOWED_UPLOAD_EXTENSIONS:
        return False, f"Unsupported file type '{ext}'. Allowed: {', '.join(config.ALLOWED_UPLOAD_EXTENSIONS)}"
    if size_bytes > config.MAX_UPLOAD_MB * 1024 * 1024:
        return False, f"File exceeds {config.MAX_UPLOAD_MB}MB limit."
    return True, None


def safe_upload_path(filename):
    """Prevent path traversal — always resolve inside KNOWLEDGE_UPLOAD_DIR."""
    config.KNOWLEDGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = os.path.basename(filename)
    return config.KNOWLEDGE_UPLOAD_DIR / safe_name
