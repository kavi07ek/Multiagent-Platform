"""
QA / Testing Agent Node
Generates comprehensive pytest test files and runs them in the sandbox.
"""

import json
from datetime import datetime, timezone

from orchestrator.state import AgentState
from tools.gemini_client import generate_json
from tools.prompts import QA_AGENT_PROMPT
from tools.sandbox import run_tests_in_sandbox

AGENT_NAME = "QA Engineer"


async def qa_agent_node(state: AgentState) -> dict:
    """Generate tests and execute them in the sandbox."""
    log = state.get("log_queue")
    workspace_mgr = state.get("workspace_mgr")
    architecture = state["architecture"]
    generated_files = state.get("generated_files", {})

    await _log(log, "AGENT_START", f"🧪 Generating test suite for {len(generated_files)} files...")

    # Build source files summary for the prompt (truncate for token limits)
    source_files_str = _format_source_files(generated_files, max_chars_per_file=800)

    prompt = QA_AGENT_PROMPT.format(
        source_files=source_files_str,
    )

    try:
        qa_result = await generate_json(prompt)
        test_files_raw = qa_result.get("test_files", [])
        test_plan = qa_result.get("test_plan", "")

        await _log(log, "AGENT_LOG", f"📝 Test plan: {test_plan}")
        await _log(log, "AGENT_LOG", f"📁 Writing {len(test_files_raw)} test files...")

        # Write test files to workspace
        test_files: dict[str, str] = {}
        for tf in test_files_raw:
            path = tf.get("path", "tests/test_unknown.py")
            content = tf.get("content", "")
            test_files[path] = content
            if workspace_mgr:
                workspace_mgr.write_file(path, content)
            await _log(
                log, "FILE_WRITTEN",
                f"  ✅ {path}",
                metadata={"path": path, "size": len(content)}
            )

        # Run tests in sandbox
        await _log(log, "AGENT_LOG", "🏃 Running tests in sandbox...")

        test_results = {"summary": "Skipped (no workspace)", "passed": 0, "failed": 0, "errors": 0}
        if workspace_mgr:
            test_results = await run_tests_in_sandbox(str(workspace_mgr.workspace_dir))

        summary = test_results.get("summary", "")
        passed = test_results.get("passed", 0)
        failed = test_results.get("failed", 0)

        if failed == 0 and test_results.get("exit_code", -1) == 0:
            await _log(log, "TEST_RESULT", f"✅ Tests passed: {summary}")
        else:
            await _log(log, "TEST_RESULT", f"⚠️  Test results: {summary}")

        if test_results.get("stdout"):
            await _log(
                log, "AGENT_LOG",
                f"📋 Test output:\n{test_results['stdout'][:1500]}",
                metadata={"stdout": test_results["stdout"]}
            )

        await _log(log, "AGENT_DONE", f"✅ QA complete: {passed} passed, {failed} failed")

        return {
            "test_files": test_files,
            "test_results": test_results,
        }

    except Exception as e:
        await _log(log, "ERROR", f"❌ QA Agent failed: {str(e)}")
        # Don't raise — partial failure is acceptable; return empty results
        return {
            "test_files": {},
            "test_results": {"summary": f"QA failed: {str(e)}", "passed": 0, "failed": 0, "errors": 1},
        }


def _format_source_files(files: dict[str, str], max_chars_per_file: int = 600) -> str:
    """Format source files for prompt injection with truncation."""
    parts = []
    for path, content in files.items():
        truncated = content[:max_chars_per_file]
        if len(content) > max_chars_per_file:
            truncated += f"\n... (truncated, {len(content)} total chars)"
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
