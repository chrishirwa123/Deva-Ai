from flask import Blueprint, request, jsonify

from knowledge import document_service

bp = Blueprint("knowledge", __name__, url_prefix="/api/knowledge")


@bp.get("/documents")
def list_documents():
    return jsonify(document_service.list_documents())


@bp.get("/documents/<int:doc_id>")
def get_document(doc_id):
    doc = document_service.get_document(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    return jsonify(doc)


@bp.delete("/documents/<int:doc_id>")
def delete_document(doc_id):
    ok = document_service.delete_document(doc_id)
    if not ok:
        return jsonify({"error": "Document not found"}), 404
    return jsonify({"deleted": True})


@bp.get("/search")
def search():
    q = request.args.get("q", "")
    return jsonify(document_service.search_chunks(q))


@bp.post("/upload")
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)

    ok, error = document_service.validate_upload(file.filename, size)
    if not ok:
        return jsonify({"error": error}), 400

    dest = document_service.safe_upload_path(file.filename)
    file.save(str(dest))

    try:
        doc_id = document_service.save_upload(dest, title=request.form.get("title"))
    except (ValueError, RuntimeError) as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(document_service.get_document(doc_id)), 201
