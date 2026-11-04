"""
Autonomous Multi-Agent Software Engineering Platform
FastAPI Backend Entry Point
"""

import asyncio
import json
import os
import uuid
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models.schemas import RunRequest, RunStatus
from orchestrator.graph import build_graph, run_pipeline
from tools.workspace import WorkspaceManager

load_dotenv()

app = FastAPI(
    title="Multi-Agent Platform API",
    description="Autonomous software engineering pipeline powered by LangGraph + Gemini",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store: run_id → {status, log_queue, workspace_dir, files}
runs: dict[str, dict] = {}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/api/run", response_model=RunStatus)
async def start_run(request: RunRequest):
    """Start a new agent pipeline run. Returns run_id immediately."""
    run_id = str(uuid.uuid4())
    log_queue: asyncio.Queue = asyncio.Queue()

    workspace_mgr = WorkspaceManager(run_id)
    workspace_dir = workspace_mgr.create_workspace()

    runs[run_id] = {
        "status": "running",
        "log_queue": log_queue,
        "workspace_mgr": workspace_mgr,
        "workspace_dir": workspace_dir,
        "files": {},
        "result": None,
    }

    # Launch the pipeline as a background task
    asyncio.create_task(
        _run_pipeline_task(run_id, request.specification, log_queue, workspace_mgr)
    )

    return RunStatus(run_id=run_id, status="running")


async def _run_pipeline_task(
    run_id: str,
    specification: str,
    log_queue: asyncio.Queue,
    workspace_mgr: WorkspaceManager,
):
    """Background task that executes the full LangGraph pipeline."""
    try:
        graph = build_graph()
        result = await run_pipeline(
            graph=graph,
            specification=specification,
            log_queue=log_queue,
            workspace_mgr=workspace_mgr,
            run_id=run_id,
        )
        runs[run_id]["status"] = "completed"
        runs[run_id]["result"] = result
        runs[run_id]["files"] = result.get("generated_files", {})
    except Exception as e:
        runs[run_id]["status"] = "failed"
        await log_queue.put(
            {
                "type": "ERROR",
                "agent": "system",
                "message": f"Pipeline failed: {str(e)}",
                "timestamp": _now(),
            }
        )
    finally:
        # Signal SSE stream to close
        await log_queue.put(None)


@app.get("/api/stream/{run_id}")
async def stream_logs(run_id: str):
    """SSE endpoint — streams agent log events for a given run."""
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        log_queue: asyncio.Queue = runs[run_id]["log_queue"]
        while True:
            try:
                event = await asyncio.wait_for(log_queue.get(), timeout=60.0)
                if event is None:
                    # Send a final "done" event
                    yield f"data: {json.dumps({'type': 'DONE', 'status': runs[run_id]['status']})}\n\n"
                    break
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Heartbeat to keep connection alive
                yield f"data: {json.dumps({'type': 'HEARTBEAT'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/files/{run_id}")
async def get_files(run_id: str):
    """Return the generated file tree for a completed run."""
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = runs[run_id]
    return {
        "run_id": run_id,
        "status": run["status"],
        "files": run.get("files", {}),
    }


@app.get("/api/zip/{run_id}")
async def download_zip(run_id: str):
    """Stream a ZIP archive of all generated files."""
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")

    run = runs[run_id]
    workspace_mgr: WorkspaceManager = run["workspace_mgr"]

    zip_bytes = workspace_mgr.create_zip()

    return StreamingResponse(
        iter([zip_bytes]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=project-{run_id[:8]}.zip"
        },
    )


@app.get("/api/runs/{run_id}/status")
async def get_run_status(run_id: str):
    """Get the current status of a pipeline run."""
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = runs[run_id]
    return {
        "run_id": run_id,
        "status": run["status"],
        "file_count": len(run.get("files", {})),
    }


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
