"""Small durable SQLite document store. JSON payloads keep the prototype schema flexible."""
from __future__ import annotations
import json, sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any
from app.core.config import settings

@contextmanager
def connect():
    conn = sqlite3.connect(str(settings.database_file), timeout=15)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db() -> None:
    with connect() as c:
        c.execute("CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(collection,id))")
        c.execute("CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection)")

def put(collection: str, doc_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    with connect() as c:
        c.execute("INSERT INTO documents(collection,id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at", (collection, doc_id, json.dumps(payload, ensure_ascii=False), now))
    return payload

def put_if_absent(collection: str, doc_id: str, payload: dict[str, Any]) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    with connect() as c:
        cursor = c.execute(
            "INSERT OR IGNORE INTO documents(collection,id,payload,updated_at) VALUES(?,?,?,?)",
            (collection, doc_id, json.dumps(payload, ensure_ascii=False), now),
        )
    return cursor.rowcount == 1

def claim_retryable(collection: str, doc_id: str, payload: dict[str, Any]) -> tuple[bool, dict[str, Any] | None]:
    now = datetime.now(timezone.utc).isoformat()
    with connect() as c:
        cursor = c.execute(
            "INSERT OR IGNORE INTO documents(collection,id,payload,updated_at) VALUES(?,?,?,?)",
            (collection, doc_id, json.dumps(payload, ensure_ascii=False), now),
        )
        if cursor.rowcount == 1:
            return True, None
        row = c.execute(
            "SELECT payload FROM documents WHERE collection=? AND id=?",
            (collection, doc_id),
        ).fetchone()
        current = json.loads(row["payload"]) if row else None
        if current and current.get("status") == "failed":
            c.execute(
                "UPDATE documents SET payload=?,updated_at=? WHERE collection=? AND id=?",
                (json.dumps(payload, ensure_ascii=False), now, collection, doc_id),
            )
            return True, current
        return False, current

def get(collection: str, doc_id: str) -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute("SELECT payload FROM documents WHERE collection=? AND id=?", (collection, doc_id)).fetchone()
    return json.loads(row["payload"]) if row else None

def all_docs(collection: str) -> list[dict[str, Any]]:
    with connect() as c:
        rows = c.execute("SELECT payload FROM documents WHERE collection=? ORDER BY updated_at DESC", (collection,)).fetchall()
    return [json.loads(row["payload"]) for row in rows]

def delete_collection(collection: str) -> None:
    with connect() as c:
        c.execute("DELETE FROM documents WHERE collection=?", (collection,))

def count(collection: str) -> int:
    with connect() as c:
        row = c.execute("SELECT COUNT(*) AS n FROM documents WHERE collection=?", (collection,)).fetchone()
    return int(row["n"])
