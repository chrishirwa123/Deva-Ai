"""
Thin wrapper around the local Ollama HTTP API.

Nothing here ever falls back to a cloud LLM. If Ollama is unreachable
or the model is missing, we raise a typed error that the routes layer
turns into an honest error message for the UI — we never fabricate a
response.
"""
import json
import requests

from config import config


class OllamaError(Exception):
    """Base error for anything Ollama-related."""


class OllamaUnavailable(OllamaError):
    """Ollama isn't reachable at all (connection refused/timeout)."""


class OllamaModelMissing(OllamaError):
    """Ollama is reachable but the configured model isn't pulled."""


def check_health():
    """Returns dict: {ok, models: [...], selected_model_available, error}"""
    try:
        resp = requests.get(f"{config.OLLAMA_URL}/api/tags", timeout=5)
        resp.raise_for_status()
        data = resp.json()
        models = [m.get("name") for m in data.get("models", [])]
        selected_available = any(
            m == config.OLLAMA_MODEL or m.split(":")[0] == config.OLLAMA_MODEL.split(":")[0]
            for m in models
        )
        return {
            "ok": True,
            "models": models,
            "selected_model": config.OLLAMA_MODEL,
            "selected_model_available": selected_available,
            "error": None,
        }
    except requests.exceptions.RequestException as e:
        return {
            "ok": False,
            "models": [],
            "selected_model": config.OLLAMA_MODEL,
            "selected_model_available": False,
            "error": str(e),
        }


def list_models():
    health = check_health()
    if not health["ok"]:
        raise OllamaUnavailable(health["error"])
    return health["models"]


def chat_stream(messages, model=None, temperature=None, max_tokens=None):
    """
    Yields text chunks as they arrive from Ollama's /api/chat streaming
    endpoint. Raises OllamaUnavailable / OllamaModelMissing on failure
    before any chunk is yielded where possible.
    """
    model = model or config.OLLAMA_MODEL
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature if temperature is not None else config.DEFAULT_TEMPERATURE,
            "num_predict": max_tokens or config.DEFAULT_MAX_TOKENS,
        },
    }
    try:
        with requests.post(
            f"{config.OLLAMA_URL}/api/chat",
            json=payload,
            stream=True,
            timeout=config.OLLAMA_TIMEOUT_SECONDS,
        ) as resp:
            if resp.status_code == 404:
                raise OllamaModelMissing(f"Model '{model}' not found on this Ollama instance.")
            resp.raise_for_status()
            for line in resp.iter_lines():
                if not line:
                    continue
                try:
                    obj = json.loads(line.decode("utf-8"))
                except json.JSONDecodeError:
                    continue
                if obj.get("error"):
                    msg = obj["error"]
                    if "not found" in msg.lower():
                        raise OllamaModelMissing(msg)
                    raise OllamaError(msg)
                chunk = obj.get("message", {}).get("content", "")
                if chunk:
                    yield chunk
                if obj.get("done"):
                    break
    except requests.exceptions.ConnectionError as e:
        raise OllamaUnavailable(f"Could not reach Ollama at {config.OLLAMA_URL}: {e}")
    except requests.exceptions.Timeout as e:
        raise OllamaUnavailable(f"Ollama request timed out: {e}")


def chat_once(messages, model=None, temperature=None, max_tokens=None):
    """Non-streaming convenience wrapper — collects the full response."""
    return "".join(chat_stream(messages, model=model, temperature=temperature, max_tokens=max_tokens))


def embed(text, model=None):
    """
    Calls Ollama's embeddings endpoint. Not used by default (the
    knowledge library ships with keyword search — see
    knowledge/document_service.py) but available if you pull an
    embedding model (e.g. `ollama pull nomic-embed-text`) and want to
    upgrade retrieval to true semantic search.
    """
    model = model or config.OLLAMA_EMBED_MODEL
    try:
        resp = requests.post(
            f"{config.OLLAMA_URL}/api/embeddings",
            json={"model": model, "prompt": text},
            timeout=config.OLLAMA_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        return resp.json().get("embedding")
    except requests.exceptions.RequestException as e:
        raise OllamaUnavailable(str(e))
