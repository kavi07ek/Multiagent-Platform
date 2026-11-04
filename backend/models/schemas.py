"""Pydantic schemas for the Multi-Agent Platform API."""

from typing import Optional
from pydantic import BaseModel, Field


class RunRequest(BaseModel):
    specification: str = Field(
        ...,
        min_length=10,
        max_length=8000,
        description="Plain-English software specification",
        examples=["Build a REST API for a todo list with CRUD operations using FastAPI and SQLite."],
    )


class RunStatus(BaseModel):
    run_id: str
    status: str  # "running" | "completed" | "failed"


class AgentLogEvent(BaseModel):
    type: str  # "AGENT_START" | "AGENT_LOG" | "AGENT_DONE" | "FILE_WRITTEN" | "TEST_RESULT" | "ERROR" | "DONE"
    agent: str
    message: str
    timestamp: str
    metadata: Optional[dict] = None


class FileNode(BaseModel):
    path: str
    content: str
    language: Optional[str] = None
