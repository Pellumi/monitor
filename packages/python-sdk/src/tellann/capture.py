"""What a captured request is allowed to carry out of the application process.

Mirrors `capture.ts` in `@tellann/backend-sdk`, field for field, so a QA run of
a Python service and a QA run of a Node service show the same shape of
evidence.

Two independent protections apply to a run's payloads. This module is the
first: anything that looks like a credential never leaves the server, and
bodies are clipped so one large upload cannot push an event past the
collector's size limit. The second lives in the desktop and the ingestion
pipeline, which classify every remaining leaf and encrypt it at rest.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, Optional

#: Per-body ceiling before clipping.
DEFAULT_MAX_BODY_BYTES = 8 * 1024

#: Key names whose value is dropped outright. Token based rather than substring
#: based: a substring test drops ordinary fields by accident (`profile`
#: contains `file`, `company` contains `pan`).
SECRET_TOKENS = frozenset({
    "password", "passwd", "passcode", "passphrase", "secret", "token", "jwt", "bearer",
    "authorization", "cookie", "cookies", "cvv", "cvc", "pin", "otp", "credential",
    "credentials", "pan", "salt", "hash", "signature",
})

SECRET_PHRASES = (
    "cardnumber", "cardnum", "creditcard", "debitcard", "securitycode",
    "sessionid", "sessiontoken", "sessionkey", "privatekey", "secretkey", "apikey",
    "accesstoken", "refreshtoken", "idtoken", "clientsecret", "setcookie", "csrftoken",
)

#: Request and response headers worth keeping. Everything else is dropped.
SAFE_HEADERS = frozenset({
    "accept", "accept-encoding", "accept-language", "content-type", "content-length",
    "host", "origin", "referer", "user-agent", "x-request-id", "x-requested-with",
    "x-forwarded-proto", "cache-control", "etag", "location", "retry-after",
})

_CAMEL_BOUNDARY = re.compile(r"([a-z0-9])([A-Z])")
_NON_ALPHANUMERIC = re.compile(r"[^A-Za-z0-9]+")


def resolve_capture_config(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Fill in the capture defaults. Bodies and headers are on by default."""
    config = config or {}
    return {
        "request_body": config.get("request_body", True),
        "response_body": config.get("response_body", True),
        "headers": config.get("headers", True),
        "max_body_bytes": int(config.get("max_body_bytes", DEFAULT_MAX_BODY_BYTES)),
        "redact_keys": [str(key).lower() for key in config.get("redact_keys", [])],
    }


def _tokens_of(key: str) -> list[str]:
    spaced = _CAMEL_BOUNDARY.sub(r"\1 \2", key)
    return [token.lower() for token in _NON_ALPHANUMERIC.split(spaced) if token]


def is_secret_key(key: str, extra: Iterable[str] = ()) -> bool:
    lowered = key.lower()
    if lowered in set(extra):
        return True
    tokens = _tokens_of(key)
    if any(token in SECRET_TOKENS for token in tokens):
        return True
    joined = "".join(tokens)
    return any(phrase in joined for phrase in SECRET_PHRASES)


def _json_bytes(value: Any) -> Optional[int]:
    try:
        return len(json.dumps(value, default=str).encode("utf-8"))
    except Exception:
        return None


def clip_to_budget(value: Any, max_bytes: int) -> Any:
    """Keep a sanitized payload inside its byte budget.

    A body over budget is replaced by a description of itself rather than a
    half-serialized fragment: truncated JSON reads as corrupt data in the run,
    while "an object with these keys, this big" is still useful.
    """
    size = _json_bytes(value)
    if size is None:
        return "[UNSERIALIZABLE]"
    if size <= max_bytes:
        return value
    if isinstance(value, str):
        return value[:max_bytes] + "…[TRUNCATED]"
    if isinstance(value, (list, tuple)):
        return {"truncated": True, "kind": "array", "length": len(value), "bytes": size}
    if isinstance(value, dict):
        return {"truncated": True, "kind": "object", "keys": list(value.keys())[:50], "bytes": size}
    return "[TRUNCATED]"


def sanitize_payload(value: Any, capture: Dict[str, Any]) -> Any:
    """Copy a payload, dropping credential-shaped fields and clipping it.

    Returns `None` when there is nothing worth sending, so the caller can leave
    the field off the event entirely.
    """
    if value is None:
        return None
    redact = capture.get("redact_keys", [])

    def visit(child: Any, key: str, depth: int) -> Any:
        if depth > 8:
            return "[TRUNCATED]"
        if child is None or isinstance(child, (bool, int, float)):
            return child
        if isinstance(child, (bytes, bytearray)):
            return f"[BINARY · {len(child)} bytes]"
        if isinstance(child, str):
            if key and is_secret_key(key, redact):
                return "[REDACTED]"
            return child if len(child) <= 4_096 else child[:4_096] + "…[TRUNCATED]"
        if isinstance(child, (list, tuple, set)):
            return [visit(item, f"{key}.{index}", depth + 1) for index, item in enumerate(list(child)[:100])]
        if isinstance(child, dict):
            return {
                str(child_key): (
                    "[REDACTED]" if is_secret_key(str(child_key), redact)
                    else visit(item, str(child_key), depth + 1)
                )
                for child_key, item in list(child.items())[:100]
            }
        return str(child)[:2_000]

    return clip_to_budget(visit(value, "", 0), capture.get("max_body_bytes", DEFAULT_MAX_BODY_BYTES))


def sanitize_headers(
    headers: Optional[Dict[str, Any]],
    capture: Dict[str, Any],
) -> Optional[Dict[str, str]]:
    """The safe subset of a header bag, with credential headers never included."""
    if not capture.get("headers", True) or not headers:
        return None
    redact = capture.get("redact_keys", [])
    kept = {
        str(key).lower(): str(value)[:500]
        for key, value in list(headers.items())[:100]
        if str(key).lower() in SAFE_HEADERS and not is_secret_key(str(key), redact)
    }
    return kept or None


def payload_bytes(value: Any) -> Optional[int]:
    """Best-effort byte size of a payload, for the run's throughput totals."""
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        return len(value)
    if isinstance(value, str):
        return len(value.encode("utf-8"))
    return _json_bytes(value)


def parse_body(raw: Any, content_type: str = "") -> Any:
    """Parse a body the framework handed over as bytes or a raw string."""
    if raw is None:
        return None
    if isinstance(raw, (bytes, bytearray)):
        try:
            raw = raw.decode("utf-8")
        except Exception:
            return f"[BINARY · {len(raw)} bytes]"
    if not isinstance(raw, str):
        return raw
    if not raw:
        return None
    stripped = raw.lstrip()
    if "json" in content_type.lower() or stripped[:1] in "[{":
        try:
            return json.loads(raw)
        except Exception:
            return raw
    if "x-www-form-urlencoded" in content_type.lower():
        from urllib.parse import parse_qsl

        return dict(parse_qsl(raw))
    return raw
