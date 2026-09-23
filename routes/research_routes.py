from flask import Blueprint, request, jsonify

from research import task_service

bp = Blueprint("research", __name__, url_prefix="/api/research")


@bp.get("/tasks")
def list_tasks():
    return jsonify(task_service.list_tasks())


@bp.get("/tasks/<int:task_id>")
def get_task(task_id):
    task = task_service.get_task(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


@bp.post("/tasks")
def create_and_run_task():
    """
    Synchronous for simplicity (single-user local app): creates the
    task, runs it immediately, and returns the finished (or errored)
    result. The frontend shows a loading state while this call is in
    flight.
    """
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400
    save_to_library = bool(data.get("save_to_library", True))
    task_id = task_service.create_task(query)
    result = task_service.run_task(task_id, query, save_to_library=save_to_library)
    return jsonify(result), 201
