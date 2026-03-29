"""
LLM Service — Unified interface for language model inference.

Strategy:
1. Try Groq API first (fast cloud inference)
2. Fall back to Ollama (local, offline-capable)
3. Retries with exponential backoff on transient failures

This abstraction lets all services call `generate()` without caring about the provider.
"""

import json
import httpx
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings

# ─── Groq Client (lazy init) ─────────────────────────────────────

_groq_client = None


def _get_groq_client():
    """Lazily initialize the Groq client only if an API key is configured."""
    global _groq_client
    if _groq_client is None and settings.GROQ_API_KEY:
        from groq import AsyncGroq
        _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _groq_client


# ─── Groq Generation ─────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.HTTPError, ConnectionError, TimeoutError)),
    reraise=True
)
async def _generate_groq(system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
    """Generate a response using Groq's API with retry logic."""
    client = _get_groq_client()
    if not client:
        raise ConnectionError("Groq client not available")

    kwargs = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 4096,
    }

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


# ─── Ollama Generation (fallback) ────────────────────────────────

@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    retry=retry_if_exception_type((httpx.HTTPError, ConnectionError)),
    reraise=True
)
async def _generate_ollama(system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
    """Generate a response using the local Ollama instance."""
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
    }

    if json_mode:
        payload["format"] = "json"

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"]


# ─── Public API ───────────────────────────────────────────────────

async def generate(
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = False
) -> str:
    """
    Generate an LLM response, trying Groq first, then falling back to Ollama.

    Args:
        system_prompt: The system/role instructions
        user_prompt: The user's question or context
        json_mode: If True, request structured JSON output

    Returns:
        The model's text response
    """
    # Attempt 1: Groq (fast cloud inference)
    if settings.GROQ_API_KEY:
        try:
            result = await _generate_groq(system_prompt, user_prompt, json_mode)
            print("[LLM] Response from Groq ✓")
            return result
        except Exception as e:
            print(f"[LLM] Groq failed: {e}, falling back to Ollama...")

    # Attempt 2: Ollama (local fallback)
    try:
        result = await _generate_ollama(system_prompt, user_prompt, json_mode)
        print("[LLM] Response from Ollama ✓")
        return result
    except Exception as e:
        print(f"[LLM] Ollama also failed: {e}")
        raise RuntimeError(
            "All LLM providers failed. Ensure Groq API key is set or Ollama is running."
        ) from e


async def generate_json(system_prompt: str, user_prompt: str) -> dict:
    """
    Convenience wrapper that generates and parses a JSON response.
    Falls back to extracting JSON from markdown code fences if needed.
    """
    raw = await generate(system_prompt, user_prompt, json_mode=True)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try extracting JSON from markdown code fences (```json ... ```)
        import re
        match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        # Last resort: find first { ... } block
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError(f"Could not parse JSON from LLM response: {raw[:200]}")
