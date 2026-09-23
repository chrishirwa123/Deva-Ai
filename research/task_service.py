"""
Orchestrates a research task: search -> fetch -> summarize -> store.
Runs synchronously (fine for a single-user local app); the route layer
marks the task running/done/error in the DB so the UI can poll status.
"""
from datetime import datetime, timezone

from ai import ollama_client
from ai.prompts import load_identity
from memory.database import cursor, rows_to_list
from research.search_service import search, SearchUnavailable
from research.fetch_service import fetch_readable_text, FetchError
from knowledge.document_service import save_research_document


def create_task(query):
    with cursor() as cur:
        cur.execute("INSERT INTO research_tasks (query, status) VALUES (?, 'pending')", (query,))
        return cur.lastrowid


def get_task(task_id):
    with cursor() as cur:
        cur.execute("SELECT * FROM research_tasks WHERE id=?", (task_id,))
        task = cur.fetchone()
        if not task:
            return None
        cur.execute("SELECT * FROM research_sources WHERE task_id=?", (task_id,))
        sources = rows_to_list(cur.fetchall())
        result = dict(task)
        result["sources"] = sources
        return result


def list_tasks():
    with cursor() as cur:
        cur.execute("SELECT * FROM research_tasks ORDER BY created_at DESC")
        return rows_to_list(cur.fetchall())


def _set_status(task_id, status, summary=None, error=None):
    with cursor() as cur:
        cur.execute(
            """UPDATE research_tasks SET status=?, summary=?, error=?,
               completed_at = CASE WHEN ? IN ('done','error') THEN datetime('now') ELSE completed_at END
               WHERE id=?""",
            (status, summary, error, status, task_id),
        )


def run_task(task_id, query, save_to_library=True):
    """
    Executes the research task synchronously. Honest failure modes:
    if search or every fetch fails (e.g. no internet), the task ends
    in 'error' with a clear message — nothing is fabricated.
    """
    _set_status(task_id, "running")
    try:
        results = search(query)
    except SearchUnavailable as e:
        _set_status(task_id, "error", error=str(e))
        return get_task(task_id)

    if not results:
        _set_status(task_id, "error", error="No search results found for this query.")
        return get_task(task_id)

    fetched = []
    with cursor() as cur:
        for r in results:
            try:
                text = fetch_readable_text(r["url"])
            except FetchError:
                continue
            cur.execute(
                "INSERT INTO research_sources (task_id, title, url, excerpt) VALUES (?,?,?,?)",
                (task_id, r["title"], r["url"], text[:400]),
            )
            fetched.append({"title": r["title"], "url": r["url"], "text": text})

    if not fetched:
        _set_status(task_id, "error", error="Found search results but could not fetch any page content.")
        return get_task(task_id)

    identity = load_identity()
    sources_block = "\n\n".join(
        f"SOURCE: {f['title']} ({f['url']})\n{f['text'][:2500]}" for f in fetched
    )
    prompt = (
        f"You are {identity.get('ai_name', 'Deva AI')}. Summarize the following research sources "
        f"about: \"{query}\".\nWrite a clear, factual summary (150-300 words). After the summary, "
        f"list which source each key point came from. Do not invent information not present in the "
        f"sources below.\n\n{sources_block}"
    )
    try:
        summary = ollama_client.chat_once([{"role": "user", "content": prompt}])
    except Exception as e:
        _set_status(task_id, "error", error=f"Fetched sources but summarization failed: {e}")
        return get_task(task_id)

    _set_status(task_id, "done", summary=summary)

    if save_to_library:
        retrieved_at = datetime.now(timezone.utc).isoformat()
        combined = summary + "\n\n---\nSources:\n" + "\n".join(f"- {f['title']}: {f['url']}" for f in fetched)
        save_research_document(title=f"Research: {query}", url=fetched[0]["url"],
                                content=combined, retrieved_at=retrieved_at, tags="research")

    return get_task(task_id)
