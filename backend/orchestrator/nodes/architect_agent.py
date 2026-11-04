"""
System Architect Agent Node
Converts PRD into a full system architecture and file implementation plan.
"""

import json
from datetime import datetime, timezone

from orchestrator.state import AgentState
from tools.gemini_client import generate_json
from tools.prompts import ARCHITECT_AGENT_PROMPT

AGENT_NAME = "System Architect"


async def architect_agent_node(state: AgentState) -> dict:
    """Design system architecture and file plan from PRD."""
    log = state.get("log_queue")
    prd = state["prd"]

    await _log(log, "AGENT_START", f"🏗️ Designing system architecture for: {prd.get('title', 'project')}...")

    prompt = ARCHITECT_AGENT_PROMPT.format(prd=json.dumps(prd, indent=2))

    try:
        architecture = await generate_json(prompt)
        tech = architecture.get("tech_stack", {})
        file_plan = architecture.get("file_plan", [])
        endpoints = architecture.get("api_endpoints", [])

        await _log(
            log, "AGENT_LOG",
            f"📐 Tech stack: {tech.get('language', '?')} + {tech.get('framework', '?')} + {tech.get('database', '?')}"
        )
        await _log(
            log, "AGENT_DONE",
            f"✅ Architecture ready: {len(file_plan)} files planned, {len(endpoints)} API endpoints"
        )

        return {"architecture": architecture}
    except Exception as e:
        await _log(log, "ERROR", f"❌ Architect Agent failed: {str(e)}")
        raise


async def _log(queue, event_type: str, message: str):
    if queue:
        await queue.put({
            "type": event_type,
            "agent": AGENT_NAME,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
