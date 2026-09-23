"""
Fetches and extracts readable text from a web page.

IMPORTANT: fetched page content is untrusted data. It is only ever
used as reference material summarized by the model — it is never
treated as instructions, and it is never used to construct or execute
shell commands or file operations.
"""
import requests
from bs4 import BeautifulSoup

from config import config


class FetchError(Exception):
    pass


_BLOCK_TAGS = ["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]


def fetch_readable_text(url, max_chars=6000):
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (DevaAI local research assistant)"},
            timeout=config.RESEARCH_FETCH_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise FetchError(f"Could not fetch {url}: {e}")

    content_type = resp.headers.get("Content-Type", "")
    if "text/html" not in content_type:
        raise FetchError(f"Skipping non-HTML content at {url} ({content_type})")

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag_name in _BLOCK_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    text = soup.get_text(separator="\n")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    cleaned = "\n".join(lines)
    return cleaned[:max_chars]
