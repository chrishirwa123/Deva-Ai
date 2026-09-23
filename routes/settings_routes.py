import json
from flask import Blueprint, request, jsonify

from config import config
from memory.database import cursor
from ai.prompts import load_identity

bp = Blueprint("settings", __name__, url_prefix="/api")


# --- App settings (key/value table) ------------------------------------

DEFAULT_SETTINGS = {
    "ollama_url": config.OLLAMA_URL,
    "ollama_model": config.OLLAMA_MODEL,
    "temperature": str(config.DEFAULT_TEMPERATURE),
    "max_tokens": str(config.DEFAULT_MAX_TOKENS),
    "system_prompt_extra": "",
    "theme": "dark",
    "accent_color": "violet",
    "animation_intensity": "normal",
    "research_provider": config.RESEARCH_PROVIDER,
    "voice_output_enabled": "false",
    "voice_input_enabled": "false",
}


@bp.get("/settings")
def get_settings():
    with cursor() as cur:
        cur.execute("SELECT key, value FROM settings")
        stored = {row["key"]: row["value"] for row in cur.fetchall()}
    merged = {**DEFAULT_SETTINGS, **stored}
    return jsonify(merged)


@bp.post("/settings")
def update_settings():
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No settings provided"}), 400
    with cursor() as cur:
        for key, value in data.items():
            if key not in DEFAULT_SETTINGS:
                continue  # ignore unknown keys rather than polluting the table
            cur.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, str(value)),
            )
    return get_settings()


@bp.post("/settings/reset")
def reset_settings():
    with cursor() as cur:
        cur.execute("DELETE FROM settings")
    return get_settings()


# --- Owner profile (identity/owner_profile.json) ------------------------

@bp.get("/profile")
def get_profile():
    return jsonify(load_identity())


@bp.post("/profile")
def update_profile():
    data = request.get_json(silent=True) or {}
    current = load_identity()
    editable_fields = [
        "ai_name", "preferred_name", "skills", "interests", "goals",
        "communication_preferences", "projects", "notes",
    ]
    for field in editable_fields:
        if field in data:
            current[field] = data[field]
    with open(config.IDENTITY_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    return jsonify(current)


# --- Data export / deletion ---------------------------------------------

@bp.get("/data/export")
def export_data():
    from ai import chat_service
    from memory import memory_service as mem
    from knowledge import document_service as kb

    return jsonify({
        "profile": load_identity(),
        "conversations": chat_service.list_conversations(),
        "memories": mem.list_memories(),
        "knowledge_documents": kb.list_documents(),
    })


@bp.post("/data/clear-chat")
def clear_chat():
    with cursor() as cur:
        cur.execute("DELETE FROM conversations")
    return jsonify({"cleared": "conversations"})


@bp.post("/data/clear-knowledge")
def clear_knowledge():
    with cursor() as cur:
        cur.execute("DELETE FROM knowledge_documents")
    return jsonify({"cleared": "knowledge"})


@bp.post("/data/reset-all")
def reset_all():
    with cursor() as cur:
        cur.execute("DELETE FROM conversations")
        cur.execute("DELETE FROM memories")
        cur.execute("DELETE FROM knowledge_documents")
        cur.execute("DELETE FROM research_tasks")
        cur.execute("DELETE FROM settings")
    return jsonify({"reset": True})
