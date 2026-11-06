"""
Gemini API Client Wrapper
Handles model invocation for all agents.
Supports live Google Gemini 3.8 Flash API as well as an intelligent
built-in demo mode when GEMINI_API_KEY is not yet configured.
"""

import json
import os
import re
import asyncio

from google import genai
from google.genai import types


DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
FALLBACK_MODELS = list(dict.fromkeys([
    DEFAULT_MODEL,
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
]))
_client: genai.Client | None = None


def is_live_mode() -> bool:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    return bool(key and not key.startswith("your_") and key != "mock")


def get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set.")
        _client = genai.Client(api_key=api_key)
    return _client


async def generate_json(prompt: str, model: str = DEFAULT_MODEL) -> dict:
    """
    Call Gemini and parse the JSON response.
    Includes automatic failover to available Gemini 3.x models if primary experiences
    temporary capacity spikes (503) or availability changes.
    """
    if not is_live_mode():
        await asyncio.sleep(0.3)
        return _mock_json_response(prompt)

    client = get_client()

    config = types.GenerateContentConfig(
        temperature=0.1,
        max_output_tokens=4096,   # JSON responses are compact — no need for 8192
        response_mime_type="application/json",
    )

    candidate_models = list(dict.fromkeys([model] + FALLBACK_MODELS))
    last_err: Exception | None = None

    for m in candidate_models:
        for attempt in range(2):
            try:
                response = await client.aio.models.generate_content(
                    model=m,
                    contents=prompt,
                    config=config,
                )
                raw = response.text.strip()
                return _parse_json_response(raw)
            except Exception as e:
                last_err = e
                err_msg = str(e)
                if any(x in err_msg for x in ["503", "429", "404", "UNAVAILABLE", "NOT_FOUND"]):
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise

    if last_err:
        raise last_err

    return _mock_json_response(prompt)


async def generate_text(prompt: str, model: str = DEFAULT_MODEL) -> str:
    """
    Call Gemini and return raw text response (for code generation).
    Includes automatic failover to available Gemini 3.x models if primary experiences
    temporary capacity spikes (503) or availability changes.
    """
    if not is_live_mode():
        await asyncio.sleep(0.5)
        return _mock_text_response(prompt)

    client = get_client()

    config = types.GenerateContentConfig(
        temperature=0.2,
        max_output_tokens=6144,   # Code files rarely exceed 6k tokens
    )

    candidate_models = list(dict.fromkeys([model] + FALLBACK_MODELS))
    last_err: Exception | None = None

    for m in candidate_models:
        for attempt in range(2):
            try:
                response = await client.aio.models.generate_content(
                    model=m,
                    contents=prompt,
                    config=config,
                )
                return response.text.strip()
            except Exception as e:
                last_err = e
                err_msg = str(e)
                if any(x in err_msg for x in ["503", "429", "404", "UNAVAILABLE", "NOT_FOUND"]):
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise

    if last_err:
        raise last_err

    return _mock_text_response(prompt)


def _parse_json_response(raw: str) -> dict:
    """Attempt to parse JSON, stripping markdown fences if present."""
    cleaned = re.sub(r"^```(?:json)?\n?", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"\n?```$", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError(f"Could not parse JSON from Gemini response: {raw[:500]}")


def _mock_json_response(prompt: str) -> dict:
    """Generate realistic responses for demo / testing without an API key."""
    if "Product Requirement Document" in prompt or "Product Manager" in prompt or "structured PRD" in prompt:
        return {
            "title": "Autonomous Service Application",
            "overview": "A high-performance production REST API service generated from user specifications.",
            "target_audience": "Developers and end-users needing reliable API services.",
            "functional_requirements": [
                {"id": "FR-1", "title": "CRUD Operations", "description": "Full create, read, update, delete functionality."},
                {"id": "FR-2", "title": "Data Validation", "description": "Robust payload schema validation with Pydantic."},
                {"id": "FR-3", "title": "Health Check & Metrics", "description": "Liveness endpoints and diagnostics."},
                {"id": "FR-4", "title": "Error Handling", "description": "Centralized exception handling with structured JSON responses."}
            ],
            "non_functional_requirements": [
                {"category": "Performance", "requirement": "Response times under 50ms for in-memory operations"},
                {"category": "Reliability", "requirement": "Structured error responses with zero unhandled crashes"},
                {"category": "Security", "requirement": "Sanitized inputs with type-safe schema enforcement"}
            ],
            "user_stories": [
                {"as_a": "API Consumer", "i_want_to": "create and manage items", "so_that": "my data persists reliably"},
                {"as_a": "DevOps Engineer", "i_want_to": "query a /health endpoint", "so_that": "monitoring systems know service status"}
            ]
        }

    if "System Architect" in prompt or "file_plan" in prompt:
        return {
            "architecture_summary": "Modular FastAPI backend with SQLite storage and Pydantic validation.",
            "tech_stack": {
                "language": "Python 3.11+",
                "framework": "FastAPI",
                "database": "SQLite / In-Memory",
                "testing": "pytest"
            },
            "file_plan": [
                {
                    "path": "models.py",
                    "description": "Pydantic models and schemas for data validation",
                    "depends_on": [],
                    "priority": 1
                },
                {
                    "path": "database.py",
                    "description": "In-memory or SQLite database connection and helper routines",
                    "depends_on": ["models.py"],
                    "priority": 2
                },
                {
                    "path": "main.py",
                    "description": "FastAPI application entry point with route handlers",
                    "depends_on": ["models.py", "database.py"],
                    "priority": 3
                },
                {
                    "path": "requirements.txt",
                    "description": "Python project dependencies",
                    "depends_on": [],
                    "priority": 4
                }
            ],
            "api_endpoints": [
                {"method": "GET", "path": "/health", "description": "Service health check"},
                {"method": "GET", "path": "/items", "description": "List all items"},
                {"method": "POST", "path": "/items", "description": "Create a new item"},
                {"method": "GET", "path": "/items/{item_id}", "description": "Get item by ID"},
                {"method": "DELETE", "path": "/items/{item_id}", "description": "Delete item by ID"}
            ]
        }

    if "QA" in prompt or "test suite" in prompt or "test_files" in prompt:
        return {
            "test_plan": "Comprehensive unit tests verifying models, database operations, and API endpoints using TestClient.",
            "test_files": [
                {
                    "path": "tests/test_api.py",
                    "content": (
                        "import pytest\n"
                        "from fastapi.testclient import TestClient\n"
                        "from main import app\n\n"
                        "client = TestClient(app)\n\n"
                        "def test_health():\n"
                        "    res = client.get('/health')\n"
                        "    assert res.status_code == 200\n"
                        "    assert res.json()['status'] == 'ok'\n\n"
                        "def test_create_and_get_item():\n"
                        "    payload = {'name': 'Test Item', 'description': 'Testing 123'}\n"
                        "    res = client.post('/items', json=payload)\n"
                        "    assert res.status_code == 201\n"
                        "    data = res.json()\n"
                        "    assert data['name'] == 'Test Item'\n"
                        "    item_id = data['id']\n\n"
                        "    get_res = client.get(f'/items/{item_id}')\n"
                        "    assert get_res.status_code == 200\n"
                        "    assert get_res.json()['name'] == 'Test Item'\n\n"
                        "def test_get_nonexistent():\n"
                        "    res = client.get('/items/non-existent-id')\n"
                        "    assert res.status_code == 404\n"
                    )
                }
            ]
        }

    if "Code Reviewer" in prompt or "overall_score" in prompt:
        return {
            "status": "PASS",
            "overall_score": 92,
            "summary": "Clean, modular code adhering to FastAPI best practices with strong type safety and test coverage.",
            "positives": [
                "Pydantic schemas enforce strict type validation.",
                "FastAPI TestClient tests cover happy paths and error states.",
                "Well-structured modular separation between models, storage, and routes."
            ],
            "issues": [
                {
                    "severity": "LOW",
                    "file": "main.py",
                    "line": 15,
                    "description": "Consider adding CORS middleware configuration if consumed by web frontends.",
                    "fix_suggestion": "Add fastapi.middleware.cors.CORSMiddleware"
                }
            ],
            "patch_instructions": None
        }

    return {"status": "ok", "message": "Demo mode simulated response"}


def _mock_text_response(prompt: str) -> str:
    """Generate realistic source code files for demo mode."""
    if "models.py" in prompt:
        return (
            "from pydantic import BaseModel, Field\n"
            "from typing import Optional\n"
            "from datetime import datetime\n\n"
            "class ItemCreate(BaseModel):\n"
            "    name: str = Field(..., min_length=1, max_length=100)\n"
            "    description: Optional[str] = None\n\n"
            "class Item(ItemCreate):\n"
            "    id: str\n"
            "    created_at: datetime\n"
        )

    if "database.py" in prompt:
        return (
            "import uuid\n"
            "from datetime import datetime, timezone\n"
            "from typing import Dict, List, Optional\n"
            "from models import Item, ItemCreate\n\n"
            "db: Dict[str, Item] = {}\n\n"
            "def create_item(payload: ItemCreate) -> Item:\n"
            "    item_id = str(uuid.uuid4())[:8]\n"
            "    item = Item(\n"
            "        id=item_id,\n"
            "        name=payload.name,\n"
            "        description=payload.description,\n"
            "        created_at=datetime.now(timezone.utc)\n"
            "    )\n"
            "    db[item_id] = item\n"
            "    return item\n\n"
            "def get_item(item_id: str) -> Optional[Item]:\n"
            "    return db.get(item_id)\n\n"
            "def list_items() -> List[Item]:\n"
            "    return list(db.values())\n\n"
            "def delete_item(item_id: str) -> bool:\n"
            "    if item_id in db:\n"
            "        del db[item_id]\n"
            "        return True\n"
            "    return False\n"
        )

    if "main.py" in prompt:
        return (
            "from fastapi import FastAPI, HTTPException, status\n"
            "from typing import List\n"
            "from models import Item, ItemCreate\n"
            "import database\n\n"
            "app = FastAPI(title='Autonomous Service', version='1.0.0')\n\n"
            "@app.get('/health')\n"
            "def health_check():\n"
            "    return {'status': 'ok', 'service': 'AgentForge Service'}\n\n"
            "@app.post('/items', response_model=Item, status_code=status.HTTP_201_CREATED)\n"
            "def create_item(item_in: ItemCreate):\n"
            "    return database.create_item(item_in)\n\n"
            "@app.get('/items', response_model=List[Item])\n"
            "def list_items():\n"
            "    return database.list_items()\n\n"
            "@app.get('/items/{item_id}', response_model=Item)\n"
            "def get_item(item_id: str):\n"
            "    item = database.get_item(item_id)\n"
            "    if not item:\n"
            "        raise HTTPException(status_code=404, detail='Item not found')\n"
            "    return item\n\n"
            "@app.delete('/items/{item_id}')\n"
            "def delete_item(item_id: str):\n"
            "    success = database.delete_item(item_id)\n"
            "    if not success:\n"
            "        raise HTTPException(status_code=404, detail='Item not found')\n"
            "    return {'status': 'deleted', 'id': item_id}\n\n"
            "if __name__ == '__main__':\n"
            "    import uvicorn\n"
            "    uvicorn.run(app, host='0.0.0.0', port=8080)\n"
        )

    if "requirements.txt" in prompt:
        return (
            "fastapi>=0.110.0\n"
            "uvicorn>=0.28.0\n"
            "pydantic>=2.0.0\n"
            "pytest>=8.0.0\n"
            "httpx>=0.27.0\n"
        )

    # Generic clean python module fallback
    return (
        "# Auto-generated module\n"
        "def run():\n"
        "    return {'status': 'success'}\n"
    )

