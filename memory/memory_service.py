"""
Long-term memory service.

Memories are short, user-approved facts ("prefers Python", "AgriSeed
Rover uses two Arduinos"). This is deliberately separate from raw
conversation history — a chat message is not a memory until it is
extracted and approved.

Retrieval here is keyword-overlap scoring, not embeddings. It's simple
and fully offline; if you later add the Ollama embeddings endpoint,
this is the function to upgrade (see get_relevant_memories).
"""
import re
from config import config
from memory.database import cursor, rows_to_list

_WORD_RE = re.compile(r"[a-zA-Z0-9]+")


def _stem(word):
    """Very light suffix stripping so 'prefers' matches 'prefer', etc."""
    for suffix in ("ing", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def _words(text):
    return set(_stem(w.lower()) for w in _WORD_RE.findall(text or "") if len(w) > 2)


def add_memory(content, topic=None, project=None, status="approved"):
    with cursor() as cur:
        cur.execute(
            "INSERT INTO memories (content, topic, project, status) VALUES (?,?,?,?)",
            (content.strip(), topic, project, status),
        )
        return cur.lastrowid


def list_memories(status=None):
    with cursor() as cur:
        if status:
            cur.execute("SELECT * FROM memories WHERE status=? ORDER BY updated_at DESC", (status,))
        else:
            cur.execute("SELECT * FROM memories ORDER BY updated_at DESC")
        return rows_to_list(cur.fetchall())


def get_memory(memory_id):
    with cursor() as cur:
        cur.execute("SELECT * FROM memories WHERE id=?", (memory_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def update_memory(memory_id, content=None, topic=None, project=None, status=None):
    existing = get_memory(memory_id)
    if not existing:
        return None
    new_content = content if content is not None else existing["content"]
    new_topic = topic if topic is not None else existing["topic"]
    new_project = project if project is not None else existing["project"]
    new_status = status if status is not None else existing["status"]
    with cursor() as cur:
        cur.execute(
            """UPDATE memories SET content=?, topic=?, project=?, status=?,
               updated_at=datetime('now') WHERE id=?""",
            (new_content, new_topic, new_project, new_status, memory_id),
        )
    return get_memory(memory_id)


def delete_memory(memory_id):
    with cursor() as cur:
        cur.execute("DELETE FROM memories WHERE id=?", (memory_id,))
        return cur.rowcount > 0


def search_memories(query, limit=20):
    q_words = _words(query)
    if not q_words:
        return []
    approved = list_memories(status="approved")
    scored = []
    for m in approved:
        overlap = len(q_words & _words(m["content"]))
        if overlap:
            scored.append((overlap, m))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [m for _, m in scored[:limit]]


def get_relevant_memories(user_message, limit=None):
    """Used by chat_service to inject context before calling the model."""
    limit = limit or config.MAX_MEMORY_ITEMS_IN_CONTEXT
    return search_memories(user_message, limit=limit)


# --- Very conservative "remember this" command detection -------------
# Deliberately narrow: we only auto-extract when the user explicitly
# addresses Deva with a remember/forget command. We never silently
# promote ordinary chat content into permanent memory.

_REMEMBER_PATTERNS = [
    re.compile(r"remember that (.+)", re.IGNORECASE),
    re.compile(r"remember this[:,]?\s*(.+)", re.IGNORECASE),
]
_FORGET_PATTERNS = [
    re.compile(r"forget (?:that )?(.+)", re.IGNORECASE),
]


def detect_memory_command(text):
    """
    Returns a dict like {"action": "remember", "content": "..."} or
    {"action": "forget", "query": "..."} or None if no command is present.
    This only detects intent — the caller decides whether to ask for
    confirmation before writing anything.
    """
    for pat in _REMEMBER_PATTERNS:
        m = pat.search(text)
        if m:
            return {"action": "remember", "content": m.group(1).strip().rstrip(".")}
    for pat in _FORGET_PATTERNS:
        m = pat.search(text)
        if m:
            return {"action": "forget", "query": m.group(1).strip().rstrip(".")}
    return None
