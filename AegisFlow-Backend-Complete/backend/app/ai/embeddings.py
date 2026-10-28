"""Local deterministic signature vectors for clustering; no external embedding service needed."""
import hashlib

def signature_vector(text: str, dimensions: int=32) -> list[float]:
    raw=hashlib.shake_256(text.lower().encode('utf-8')).digest(dimensions)
    return [(b-127.5)/127.5 for b in raw]
