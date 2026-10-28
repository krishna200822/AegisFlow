"""Webhook signature helpers for future external log sources."""
import hashlib, hmac

def verify_hmac_sha256(body: bytes, signature: str, secret: str) -> bool:
    if not secret or not signature: return False
    expected=hmac.new(secret.encode(),body,hashlib.sha256).hexdigest()
    candidate=signature.removeprefix('sha256=')
    return hmac.compare_digest(expected,candidate)
