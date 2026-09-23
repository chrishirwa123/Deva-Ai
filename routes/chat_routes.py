import json
from flask import Blueprint, request, jsonify, Response, stream_with_context

from ai import chat_service, ollama_client
from ai.ollama_client import OllamaUnavailable, OllamaModelMissing, OllamaError
from memory import memory_service

bp = Blueprint("chat", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    ollama_health = ollama_client.check_health()
    return jsonify({
        "backend": "ok",
        "ollama": ollama_health,
    })


@bp.get("/conversations")
def get_conversations():
    return jsonify(chat_service.list_conversations())


@bp.post("/conversations")
def new_conversation():
    conv_id = chat_service.create_conversation()
    return jsonify(chat_service.get_conversation(conv_id)), 201


@bp.get("/conversations/<int:conv_id>")
def get_conversation(conv_id):
    conv = chat_service.get_conversation(conv_id)
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify(conv)


@bp.patch("/conversations/<int:conv_id>")
def rename_conversation(conv_id):
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    ok = chat_service.rename_conversation(conv_id, title)
    if not ok:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify(chat_service.get_conversation(conv_id))


@bp.delete("/conversations/<int:conv_id>")
def delete_conversation(conv_id):
    ok = chat_service.delete_conversation(conv_id)
    if not ok:
        return jsonify({"error": "Conversation not found"}), 404
    return jsonify({"deleted": True})


@bp.post("/conversations/<int:conv_id>/messages")
def send_message(conv_id):
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    use_knowledge = bool(data.get("use_knowledge", False))
    if not user_message:
        return jsonify({"error": "message is required"}), 400

    conv = chat_service.get_conversation(conv_id)
    if not conv:
        return jsonify({"error": "Conversation not found"}), 404

    # Detect (but never silently act on) memory commands.
    memory_cmd = memory_service.detect_memory_command(user_message)

    def generate():
        try:
            for chunk in chat_service.stream_reply(conv_id, user_message, use_knowledge=use_knowledge):
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        except OllamaUnavailable as e:
            yield f"data: {json.dumps({'type': 'error', 'error': 'unavailable', 'message': str(e)})}\n\n"
            return
        except OllamaModelMissing as e:
            yield f"data: {json.dumps({'type': 'error', 'error': 'model_missing', 'message': str(e)})}\n\n"
            return
        except OllamaError as e:
            yield f"data: {json.dumps({'type': 'error', 'error': 'ollama_error', 'message': str(e)})}\n\n"
            return

        payload = {"type": "done"}
        if memory_cmd:
            payload["memory_command"] = memory_cmd
        yield f"data: {json.dumps(payload)}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream")


@bp.get("/models")
def get_models():
    try:
        return jsonify({"models": ollama_client.list_models()})
    except OllamaUnavailable as e:
        return jsonify({"error": str(e)}), 503
