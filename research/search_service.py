"""
Web search provider.

Default: DuckDuckGo's HTML endpoint (html.duckduckgo.com) — no API key
needed, works out of the box. This is a best-effort scrape of a public
HTML page, not an official API, so results can be less reliable than a
paid provider; if that matters to you, set DEVA_RESEARCH_PROVIDER and
plug in Bing/SerpAPI/etc. by adding a branch below — the rest of the
research pipeline (fetch_service, document_service) doesn't care which
provider produced the URLs.
"""
import requests
from bs4 import BeautifulSoup

from config import config


class SearchUnavailable(Exception):
    pass


def _search_duckduckgo(query, max_results):
    try:
        resp = requests.post(
            "https://html.duckduckgo.com/html/",
            data={"q": query},
            headers={"User-Agent": "Mozilla/5.0 (DevaAI local research assistant)"},
            timeout=config.RESEARCH_FETCH_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise SearchUnavailable(f"Web search failed — check your internet connection ({e}).")

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    for result in soup.select(".result")[:max_results * 2]:
        link_tag = result.select_one(".result__a")
        snippet_tag = result.select_one(".result__snippet")
        if not link_tag or not link_tag.get("href"):
            continue
        results.append({
            "title": link_tag.get_text(strip=True),
            "url": link_tag["href"],
            "snippet": snippet_tag.get_text(strip=True) if snippet_tag else "",
        })
        if len(results) >= max_results:
            break
    return results


def search(query, max_results=None):
    max_results = max_results or config.RESEARCH_MAX_SOURCES
    provider = config.RESEARCH_PROVIDER
    if provider == "duckduckgo":
        return _search_duckduckgo(query, max_results)
    raise SearchUnavailable(
        f"Search provider '{provider}' is not implemented. Only 'duckduckgo' ships by default — "
        f"add credentials and a branch in research/search_service.py to enable another provider."
    )
