"""
Runtime context registry — stores non-serializable objects (asyncio.Queue, WorkspaceManager)
keyed by run_id, allowing agent nodes to access them without putting them in LangGraph state.
"""

from typing import Any


_registry: dict[str, dict[str, Any]] = {}


def register(run_id: str, log_queue, workspace_mgr) -> None:
    _registry[run_id] = {
        "log_queue": log_queue,
        "workspace_mgr": workspace_mgr,
    }


def get(run_id: str) -> dict[str, Any]:
    return _registry.get(run_id, {})


def cleanup(run_id: str) -> None:
    _registry.pop(run_id, None)
