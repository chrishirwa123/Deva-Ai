"""
Builds the system prompt injected into every conversation: identity +
relevant memories + relevant knowledge chunks. Keeping this in one
place makes it easy to audit exactly what context Deva is given.
"""
import json

from config import config


def load_identity():
    try:
        with open(config.IDENTITY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "ai_name": config.AI_NAME_DEFAULT,
            "creator": config.CREATOR_NAME_DEFAULT,
            "owner_name": config.CREATOR_NAME_DEFAULT,
            "purpose": "Personal AI assistant for local-first use.",
        }


def build_system_prompt(memories=None, knowledge_chunks=None, extra_instructions=None):
    identity = load_identity()
    lines = [
        f"You are {identity.get('ai_name', config.AI_NAME_DEFAULT)}, a personal, local-first AI assistant.",
        f"You were created by {identity.get('creator', config.CREATOR_NAME_DEFAULT)}, "
        f"who is also your primary owner and user.",
        f"Your purpose: {identity.get('purpose', 'Personal AI assistant.')}",
        "You run entirely on the owner's own computer via a local Ollama model — you are not a "
        "cloud AI service, and you do not send the owner's data anywhere unless the owner explicitly "
        "runs an online research task.",
        "Be direct, useful, and honest. If you don't know something or a tool/service is unavailable, "
        "say so plainly instead of guessing or inventing an answer.",
    ]

    preferred = identity.get("preferred_name")
    if preferred:
        lines.append(f"The owner prefers to be called {preferred}.")

    skills = identity.get("skills") or []
    if skills:
        lines.append(f"Owner's known skills/interests: {', '.join(skills)}.")

    projects = identity.get("projects") or []
    if projects:
        lines.append(f"Owner's known projects: {', '.join(projects)}.")

    if memories:
        lines.append("\nRelevant things you remember about the owner (only use if relevant to this message):")
        for m in memories:
            lines.append(f"- {m['content']}")

    if knowledge_chunks:
        lines.append("\nRelevant excerpts from the owner's saved knowledge library (cite the source when you use these):")
        for c in knowledge_chunks:
            src = c.get("title") or "Untitled document"
            lines.append(f"- [{src}] {c['content'][:600]}")

    if extra_instructions:
        lines.append(f"\n{extra_instructions}")

    return "\n".join(lines)
