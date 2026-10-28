"""Gemini provider. Model is configured server-side; no API key is exposed to the browser."""
from __future__ import annotations
import json, re
from typing import Any
from app.core.config import settings

class GeminiNotConfigured(RuntimeError): pass
class GeminiRequestError(RuntimeError): pass

def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r'^```(?:json)?\s*|\s*```$', '', cleaned, flags=re.I)
    try:
        obj = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', cleaned, flags=re.S)
        if not match: raise GeminiRequestError('Gemini response was not valid JSON.')
        try: obj = json.loads(match.group(0))
        except json.JSONDecodeError as exc: raise GeminiRequestError('Gemini response contained malformed JSON.') from exc
    if not isinstance(obj, dict): raise GeminiRequestError('Gemini response must be a JSON object.')
    return obj

def generate_json(system_instruction: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not settings.gemini_api_key:
        raise GeminiNotConfigured('GEMINI_API_KEY is empty. Add it to backend/.env and restart the API.')
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=json.dumps(payload, ensure_ascii=False),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.15,
                max_output_tokens=2200,
                response_mime_type='application/json',
            ),
        )
        text = getattr(response, 'text', None)
        if not text: raise GeminiRequestError('Gemini returned an empty response.')
        return _extract_json(text)
    except (GeminiNotConfigured, GeminiRequestError): raise
    except Exception as exc:
        raise GeminiRequestError(f"Gemini request failed for '{settings.gemini_model}'. Check model availability, API key, quota, and network.") from exc

def generate_text(system_instruction: str, payload: dict[str, Any]) -> str:
    obj = generate_json(system_instruction, payload)
    return json.dumps(obj, ensure_ascii=False, indent=2)

def check_model_support() -> None:
    if not settings.gemini_api_key:
        raise GeminiNotConfigured('GEMINI_API_KEY is empty. Configure it in the backend environment.')
    try:
        from google import genai
        client = genai.Client(api_key=settings.gemini_api_key)
        client.models.get(model=settings.gemini_model)
    except Exception as exc:
        raise GeminiRequestError('Gemini model verification failed. Check model availability, API key, quota, and network.') from exc
