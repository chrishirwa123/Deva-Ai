# Deva AI

A personal, local-first AI assistant built for Hirwa Christian, running on top of
your existing Ollama installation (`qwen3:1.7b`). Everything below has actually
been built and tested — see **Test Results** at the bottom for exactly what was
verified and how.

---

## 1. What's actually built

- **Flask backend** with a clean, multi-file structure (not one giant file)
- **Real Ollama integration** — `/api/chat` for streaming responses, `/api/tags`
  for health/model checks, honest errors when Ollama or the model is missing
- **SQLite persistence** — conversations, messages, memories, knowledge
  documents/chunks, research tasks, settings — all in `instance/deva.db`
- **Owner identity** — Deva knows it was created by Hirwa Christian, editable
  from the Owner Profile page, stored in `identity/owner_profile.json`
- **Long-term memory** — approved facts injected into context, with natural
  "remember that…" detection (never auto-saved without confirmation)
- **Knowledge library** — upload PDF/TXT/MD, chunked and keyword-indexed,
  retrieved into context only when you toggle "Knowledge Library" in chat
- **Online research** — DuckDuckGo search → fetch → summarize → save to
  library, with source URLs and retrieval dates preserved
- **Landing page, chat UI, and a JARVIS-style animated-orb assistant page**
  with browser speech input/output
- **Settings page** — Ollama URL/model/temperature, research provider, voice,
  appearance, and data export/reset — all persisted
- A **pytest smoke-test suite** (`tests/test_smoke.py`) that passes without
  Ollama running

## 2. What's simplified vs. the original spec (and why)

- **Knowledge retrieval uses keyword/stem matching, not true embeddings.**
  It works fully offline with zero extra setup. To upgrade to real semantic
  search: `ollama pull nomic-embed-text`, then swap `search_chunks()` in
  `knowledge/document_service.py` for a cosine-similarity search using
  `ai/ollama_client.embed()`. The plumbing for embeddings already exists in
  that client file.
- **Research uses DuckDuckGo's HTML endpoint**, not a paid search API — no key
  required, works out of the box. Swapping in Bing/SerpAPI is a single new
  branch in `research/search_service.py`.
- **PC-control / system automation was not implemented.** The spec correctly
  says this should be disabled by default and gated behind real
  authentication — rather than build a half-working, insecure version, it was
  left out entirely. `identity/owner_profile.json` has an `auth` block ready
  for this if you want to build it out later.
- **No production WSGI server** — this runs on Flask's built-in dev server,
  which is appropriate for a single-user local app on your own machine, but
  is not meant to be exposed beyond `127.0.0.1`.

---

## 3. Installation (Windows 11)

**Prerequisites:** Python 3.10+ installed and on PATH, Ollama installed with
`qwen3:1.7b` already pulled (`ollama pull qwen3:1.7b`).

### Option A — one command
Double-click `run_deva.bat`, or from a terminal in the project folder:

```
run_deva.bat
```

This creates a virtual environment, installs dependencies, copies
`.env.example` to `.env` on first run, checks whether Ollama is reachable, and
starts the app.

### Option B — manual steps
```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

---

## 4. Verifying Ollama is connected

1. Make sure Ollama is running: `ollama serve` (if it's not already running as
   a background service)
2. Confirm the model is pulled: `ollama list` should show `qwen3:1.7b`
3. In Deva AI, open **Settings → AI** — it shows live connection status and
   which models Ollama has available
4. Or hit the API directly: `http://127.0.0.1:5000/api/health`

If Ollama isn't reachable, the chat UI will show a clear inline error (not a
fabricated response) telling you to run `ollama serve` or pull the model.

## 5. Testing owner identity and memory

- Open **/chat**, ask "What is your name and who created you?" — Deva should
  identify itself as Deva AI, created by Hirwa Christian
- Type "Remember that I prefer dark mode interfaces." — you'll get a
  confirmation prompt before it's saved; check **Personal Memory** to see it
- Ask a related question in a *new* conversation later — the saved memory
  should surface in Deva's context and influence its answer
- Edit/delete it from the **Personal Memory** page directly

## 6. Testing offline functionality

1. Disconnect Wi-Fi
2. `/chat` should still work fully (Ollama runs locally)
3. `/research` should honestly report "cannot fetch — check your internet
   connection" rather than pretending to have current information
4. `/knowledge` search over already-uploaded documents still works

## 7. Running the automated tests
```
.venv\Scripts\activate
pip install pytest
python -m pytest tests\ -v
```
These 7 tests don't require Ollama and check: landing/chat pages render,
health endpoint responds, conversations and memories can be created/edited/
deleted, and profile/settings return sane defaults.

---

## 8. Project structure

```
DevaAI/
├── app.py                    Flask entry point, page routes
├── config.py                 All settings in one place (env-driven)
├── requirements.txt
├── .env.example
├── run_deva.bat
├── identity/owner_profile.json
├── ai/
│   ├── ollama_client.py      Ollama HTTP wrapper (chat, streaming, embeddings)
│   ├── chat_service.py       Conversation persistence + context assembly
│   └── prompts.py            System prompt construction
├── memory/
│   ├── database.py           SQLite schema + connection
│   └── memory_service.py     Long-term memory CRUD + keyword retrieval
├── research/
│   ├── search_service.py     DuckDuckGo search
│   ├── fetch_service.py      Page fetch + readable-text extraction
│   └── task_service.py       Orchestrates search → fetch → summarize → save
├── knowledge/
│   └── document_service.py   Upload, chunking, keyword retrieval
├── routes/                   One blueprint per concern
├── templates/                landing, chat, assistant, research, knowledge,
│                              memory, profile, settings, base
├── static/css/style.css      Full design system (dark/violet/cyan glass)
├── static/js/main.js         Shared API/toast/markdown helpers
├── instance/                 deva.db + uploaded files (created at runtime)
└── tests/test_smoke.py
```

---

## 9. Test results (actually run, not assumed)

Run in a Linux sandbox without Ollama installed and without outbound internet
to `html.duckduckgo.com`, to specifically verify honest-failure behavior:

| Check | Result |
|---|---|
| `pytest tests/` | **7/7 passed** |
| All 8 pages return HTTP 200 (`/`, `/chat`, `/assistant`, `/research`, `/knowledge`, `/memory`, `/profile`, `/settings`) | **Pass** |
| Conversation create → message → delete | **Pass** |
| Memory create → list → update → delete | **Pass** |
| Owner profile GET reflects `identity/owner_profile.json` | **Pass** |
| Settings GET/POST roundtrip | **Pass** |
| Knowledge upload (.txt) → chunked → indexed | **Pass** |
| Knowledge keyword search ("Arduino" matching stored "Arduinos") | **Pass** — a stemming bug was found and fixed here (see note below) |
| Chat message with Ollama unreachable | **Pass** — returns a clear inline error, no fabricated reply |
| Research task with search unreachable | **Pass** — returns a clear error, no fabricated summary |

**Bug found and fixed during testing:** the first version of keyword search
matched whole words only, so searching "Arduino" missed text containing
"Arduinos". Fixed with light suffix-stripping (`ing`/`ed`/`es`/`s`) in both
`memory_service.py` and `document_service.py`, then re-verified.

**Not yet tested (needs your actual machine):**
- Real streaming responses from `qwen3:1.7b` end-to-end (verified the
  streaming *pipeline* against a mocked/unavailable Ollama; the content
  itself needs your real Ollama instance)
- Actual DuckDuckGo search results (verified the *error path*; the sandbox
  here can't reach that domain — your Windows machine will have normal
  internet access)
- Browser speech recognition/synthesis (`assistant.html`) — this depends on
  Chrome/Edge's Web Speech API, which can only be exercised in a real browser
- PDF text extraction via `pypdf` — TXT/MD upload was tested; PDF wasn't
  exercised since none was available in the sandbox, but `pypdf` is a widely
  used library and the code path is straightforward

## 10. Missing dependencies / things to configure

- Nothing is required beyond `pip install -r requirements.txt` and your
  existing Ollama + `qwen3:1.7b`
- No API keys are needed for the default setup (DuckDuckGo search needs none)
- If you want true semantic search later: `ollama pull nomic-embed-text`
