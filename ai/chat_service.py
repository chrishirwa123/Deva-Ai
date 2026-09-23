"""
Chat orchestration: loads conversation history, injects identity +
relevant memory + relevant knowledge as a system prompt, streams the
model's response, and persists both sides of the exchange.
"""
from memory.database import cursor, rows_to_list
from memory import memory_service
from knowledge import document_service
from ai import ollama_client
from ai.prompts import build_system_prompt


def create_conversation(title="New Chat"):
    with cursor() as cur:
        cur.execute("INSERT INTO conversations (title) VALUES (?)", (title,))
        return cur.lastrowid


def list_conversations():
    with cursor() as cur:
        cur.execute("SELECT * FROM conversations ORDER BY updated_at DESC")
        return rows_to_list(cur.fetchall())


def get_conversation(conv_id):
    with cursor() as cur:
        cur.execute("SELECT * FROM conversations WHERE id=?", (conv_id,))
        conv = cur.fetchone()
        if not conv:
            return None
        cur.execute("SELECT * FROM messages WHERE conversation_id=? ORDER BY id", (conv_id,))
        msgs = rows_to_list(cur.fetchall())
        result = dict(conv)
        result["messages"] = msgs
        return result


def rename_conversation(conv_id, title):
    with cursor() as cur:
        cur.execute("UPDATE conversations SET title=?, updated_at=datetime('now') WHERE id=?", (title, conv_id))
        return cur.rowcount > 0


def delete_conversation(conv_id):
    with cursor() as cur:
        cur.execute("DELETE FROM conversations WHERE id=?", (conv_id,))
        return cur.rowcount > 0


def _touch_conversation(conv_id):
    with cursor() as cur:
        cur.execute("UPDATE conversations SET updated_at=datetime('now') WHERE id=?", (conv_id,))


def add_message(conv_id, role, content):
    with cursor() as cur:
        cur.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)",
            (conv_id, role, content),
        )
    _touch_conversation(conv_id)


def maybe_autoname_conversation(conv_id, first_user_message):
    conv = get_conversation(conv_id)
    if conv and conv["title"] == "New Chat":
        title = first_user_message.strip().replace("\n", " ")[:48]
        if len(first_user_message) > 48:
            title += "..."
        rename_conversation(conv_id, title or "New Chat")


def build_messages_for_model(conv_id, user_message, use_knowledge=False):
    """Assembles the full message list (system + history + new user turn)."""
    conv = get_conversation(conv_id)
    history = conv["messages"] if conv else []

    memories = memory_service.get_relevant_memories(user_message)
    knowledge_chunks = document_service.get_relevant_chunks(user_message) if use_knowledge else []

    system_prompt = build_system_prompt(memories=memories, knowledge_chunks=knowledge_chunks)

    messages = [{"role": "system", "content": system_prompt}]
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


def stream_reply(conv_id, user_message, use_knowledge=False, model=None, temperature=None):
    """
    Persists the user message, streams the assistant reply chunk by
    chunk (yielding strings), and persists the full assistant reply at
    the end. Callers (routes) are responsible for turning yielded
    chunks into an SSE/streaming HTTP response.
    """
    add_message(conv_id, "user", user_message)
    maybe_autoname_conversation(conv_id, user_message)

    messages = build_messages_for_model(conv_id, user_message, use_knowledge=use_knowledge)

    full_reply = []
    for chunk in ollama_client.chat_stream(messages, model=model, temperature=temperature):
        full_reply.append(chunk)
        yield chunk

    final_text = "".join(full_reply)
    if final_text.strip():
        add_message(conv_id, "assistant", final_text)
