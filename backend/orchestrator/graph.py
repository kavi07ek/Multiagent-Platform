"""
LangGraph Orchestrator — StateGraph definition.
Defines the 5-agent pipeline with a review feedback loop.
"""

import asyncio
from typing import Literal

from langgraph.graph import StateGraph, END

from orchestrator.state import AgentState
from orchestrator.nodes.pm_agent import pm_agent_node
from orchestrator.nodes.architect_agent import architect_agent_node
from orchestrator.nodes.developer_agent import developer_agent_node
from orchestrator.nodes.qa_agent import qa_agent_node
from orchestrator.nodes.reviewer_agent import reviewer_agent_node

MAX_REVIEW_ITERATIONS = 1  # Reduced from 3 — one review loop is enough for fast runs


def should_continue(state: AgentState) -> Literal["developer", "done"]:
    """
    Conditional edge after the Reviewer node.
    - FAIL + iterations remaining → loop back to Developer (patch mode)
    - PASS or max iterations hit → proceed to END
    """
    review = state.get("review_result", {})
    iteration = state.get("review_iteration", 0)

    if review.get("status") == "PASS":
        return "done"
    elif iteration >= MAX_REVIEW_ITERATIONS:
        return "done"
    else:
        return "developer"


def increment_iteration(state: AgentState) -> dict:
    """Increment the review iteration counter."""
    return {"review_iteration": state.get("review_iteration", 0) + 1}


def build_graph() -> StateGraph:
    """Build and compile the LangGraph StateGraph."""
    graph = StateGraph(AgentState)

    # Add agent nodes
    graph.add_node("pm_agent", pm_agent_node)
    graph.add_node("architect_agent", architect_agent_node)
    graph.add_node("developer_agent", developer_agent_node)
    graph.add_node("qa_agent", qa_agent_node)
    graph.add_node("reviewer_agent", reviewer_agent_node)
    graph.add_node("increment_iteration", increment_iteration)

    # Linear flow: PM → Architect → Developer
    graph.set_entry_point("pm_agent")
    graph.add_edge("pm_agent", "architect_agent")
    graph.add_edge("architect_agent", "developer_agent")
    graph.add_edge("developer_agent", "qa_agent")
    graph.add_edge("qa_agent", "reviewer_agent")

    # Conditional review loop
    graph.add_conditional_edges(
        "reviewer_agent",
        should_continue,
        {
            "developer": "increment_iteration",
            "done": END,
        },
    )

    # After incrementing, loop back to developer
    graph.add_edge("increment_iteration", "developer_agent")

    return graph.compile()


async def run_pipeline(
    graph,
    specification: str,
    log_queue: asyncio.Queue,
    workspace_mgr,
    run_id: str = "",
) -> dict:
    """
    Execute the full agent pipeline and return the final state.
    """
    initial_state: AgentState = {
        "run_id": run_id,
        "specification": specification,
        "prd": None,
        "architecture": None,
        "generated_files": {},
        "test_files": {},
        "test_results": None,
        "review_result": None,
        "review_iteration": 0,
        "patch_feedback": None,
        "log_queue": log_queue,
        "workspace_mgr": workspace_mgr,
    }

    # LangGraph config for async streaming
    config = {"recursion_limit": 50}

    final_state = await graph.ainvoke(initial_state, config=config)
    return final_state
