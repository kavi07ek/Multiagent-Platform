"""
Product Manager Agent Node
Converts raw natural language specification into a structured PRD.
"""

import asyncio
from datetime import datetime, timezone

from orchestrator.state import AgentState
from tools.gemini_client import generate_json
from tools.prompts import PM_AGENT_PROMPT

AGENT_NAME = "Product Manager"


async def pm_agent_node(state: AgentState) -> dict:
    """Parse user spec into a structured PRD JSON."""
    log = state.get("log_queue")
    await _log(log, "AGENT_START", f"🎯 Analyzing requirements and generating PRD...")

    prompt = PM_AGENT_PROMPT.format(requirement=state["specification"])

    try:
        prd = await generate_json(prompt)
        await _log(log, "AGENT_DONE", f"✅ PRD created: '{prd.get('title', 'Untitled')}' with {len(prd.get('functional_requirements', []))} requirements and {len(prd.get('user_stories', []))} user stories")
        return {"prd": prd}
    except Exception as e:
        await _log(log, "ERROR", f"❌ PM Agent failed: {str(e)}")
        raise


async def _log(queue, event_type: str, message: str):
    if queue:
        await queue.put({
            "type": event_type,
            "agent": AGENT_NAME,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
