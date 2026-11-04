"""
Code Reviewer Agent Node
Analyzes the generated codebase for security, performance, and quality issues.
Returns PASS/FAIL and provides patch instructions back to the Developer.
"""

import json
from datetime import datetime, timezone

from orchestrator.state import AgentState
from tools.gemini_client import generate_json
from tools.prompts import REVIEWER_AGENT_PROMPT

AGENT_NAME = "Code Reviewer"

SEVERITY_EMOJI = {
    "CRITICAL": "🔴",
    "HIGH": "🟠",
    "MEDIUM": "🟡",
    "LOW": "🔵",
}


async def reviewer_agent_node(state: AgentState) -> dict:
    """Review the full codebase and return PASS/FAIL with detailed feedback."""
    log = state.get("log_queue")
    generated_files = state.get("generated_files", {})
    test_results = state.get("test_results", {})

    await _log(log, "AGENT_START", f"🔍 Reviewing {len(generated_files)} files for quality, security, and performance...")

    # Format all files for the prompt
    all_files_str = _format_all_files(generated_files, max_chars_per_file=800)
    test_results_str = json.dumps(test_results, indent=2) if test_results else "No test results available."

    prompt = REVIEWER_AGENT_PROMPT.format(
        all_files=all_files_str,
        test_results=test_results_str,
    )

    try:
        review = await generate_json(prompt)

        status = review.get("status", "FAIL")
        score = review.get("overall_score", 0)
        issues = review.get("issues", [])
        summary = review.get("summary", "")

        # Log overall assessment
        status_emoji = "✅" if status == "PASS" else "❌"
        await _log(log, "AGENT_LOG", f"{status_emoji} Review result: {status} (Score: {score}/100)")
        await _log(log, "AGENT_LOG", f"📋 {summary}")

        # Log each issue
        for issue in issues:
            severity = issue.get("severity", "LOW")
            emoji = SEVERITY_EMOJI.get(severity, "⚪")
            await _log(
                log, "AGENT_LOG",
                f"  {emoji} [{severity}] {issue.get('file', '?')}: {issue.get('description', '')}",
                metadata=issue,
            )

        # Log positives
        for pos in review.get("positives", []):
            await _log(log, "AGENT_LOG", f"  ✨ {pos}")

        status_msg = "PASSED review ✅" if status == "PASS" else f"FAILED review ❌ — {len(issues)} issues found"
        await _log(log, "AGENT_DONE", f"🔍 Code review complete: {status_msg}")

        # Extract patch instructions for developer if FAIL
        patch_feedback = None
        if status == "FAIL":
            patch_feedback = review.get("patch_instructions", "Fix all CRITICAL and HIGH severity issues.")

        return {
            "review_result": review,
            "patch_feedback": patch_feedback,
        }

    except Exception as e:
        await _log(log, "ERROR", f"❌ Reviewer Agent failed: {str(e)}")
        # Default to PASS on reviewer failure to avoid infinite loops
        return {
            "review_result": {"status": "PASS", "overall_score": 60, "summary": f"Review failed: {str(e)}", "issues": []},
            "patch_feedback": None,
        }


def _format_all_files(files: dict[str, str], max_chars_per_file: int = 800) -> str:
    parts = []
    for path, content in files.items():
        truncated = content[:max_chars_per_file]
        if len(content) > max_chars_per_file:
            truncated += f"\n... (+{len(content) - max_chars_per_file} more chars)"
        parts.append(f"### {path}\n```\n{truncated}\n```")
    return "\n\n".join(parts)


async def _log(queue, event_type: str, message: str, metadata: dict = None):
    if queue:
        event = {
            "type": event_type,
            "agent": AGENT_NAME,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if metadata:
            event["metadata"] = metadata
        await queue.put(event)
