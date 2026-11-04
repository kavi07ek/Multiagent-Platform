"""
LangGraph AgentState — shared state passed between all agent nodes.
"""

from typing import Any, Optional, TypedDict


class AgentState(TypedDict, total=False):
    # Run identifier
    run_id: str

    # Input
    specification: str

    # PM Agent output
    prd: Optional[dict]

    # Architect Agent output
    architecture: Optional[dict]

    # Developer Agent output
    generated_files: dict[str, str]  # {relative_path: content}

    # QA Agent output
    test_files: dict[str, str]       # {relative_path: content}
    test_results: Optional[dict]

    # Reviewer Agent output
    review_result: Optional[dict]
    review_iteration: int            # How many review loops have occurred

    # Feedback from reviewer to developer (patch mode)
    patch_feedback: Optional[str]

    # Runtime tools (passed for direct access in nodes)
    log_queue: Optional[Any]
    workspace_mgr: Optional[Any]

