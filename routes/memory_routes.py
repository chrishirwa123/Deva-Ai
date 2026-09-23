from flask import Blueprint, request, jsonify

from memory import memory_service

bp = Blueprint("memory", __name__, url_prefix="/api/memories")


@bp.get("")
def list_memories():
    status = request.args.get("status")
    return jsonify(memory_service.list_memories(status=status))


@bp.post("")
def add_memory():
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content is required"}), 400
    memory_id = memory_service.add_memory(
        content, topic=data.get("topic"), project=data.get("project"),
        status=data.get("status", "approved"),
    )
    return jsonify(memory_service.get_memory(memory_id)), 201


@bp.get("/search")
def search_memories():
    q = request.args.get("q", "")
    return jsonify(memory_service.search_memories(q))


@bp.patch("/<int:memory_id>")
def update_memory(memory_id):
    data = request.get_json(silent=True) or {}
    updated = memory_service.update_memory(
        memory_id, content=data.get("content"), topic=data.get("topic"),
        project=data.get("project"), status=data.get("status"),
    )
    if not updated:
        return jsonify({"error": "Memory not found"}), 404
    return jsonify(updated)


@bp.delete("/<int:memory_id>")
def delete_memory(memory_id):
    ok = memory_service.delete_memory(memory_id)
    if not ok:
        return jsonify({"error": "Memory not found"}), 404
    return jsonify({"deleted": True})
