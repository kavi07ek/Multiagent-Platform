"""
Developer Agent Node
Implements all files from the architecture file plan using Gemini.
Supports patch mode when review feedback is provided.
Files with no mutual dependencies are generated concurrently for speed.
"""

import asyncio
import json
from datetime import datetime, timezone

from orchestrator.state import AgentState
from tools.gemini_client import generate_text
from tools.prompts import DEVELOPER_AGENT_PROMPT, PATCH_SECTION_TEMPLATE

AGENT_NAME = "Developer"

# Max concurrent Gemini calls during file generation
MAX_CONCURRENT_FILES = 4


async def developer_agent_node(state: AgentState) -> dict:
    """Generate source code files from the architecture plan — files are batched
    by dependency priority so independent files are generated in parallel."""
    log = state.get("log_queue")
    workspace_mgr = state.get("workspace_mgr")
    architecture = state["architecture"]
    file_plan = architecture.get("file_plan", [])
    tech_stack = architecture.get("tech_stack", {})
    arch_summary = architecture.get("architecture_summary", "")
    patch_feedback = state.get("patch_feedback")
    existing_files = state.get("generated_files", {})

    is_patch_mode = bool(patch_feedback)
    iteration = state.get("review_iteration", 0)

    if is_patch_mode:
        await _log(log, "AGENT_START", f"🔧 Patch mode (iteration {iteration}): Applying review fixes...")
    else:
        await _log(log, "AGENT_START", f"💻 Implementing {len(file_plan)} files in parallel batches...")

    generated_files = dict(existing_files)

    # Group files into priority batches (same priority = generate in parallel)
    priority_buckets: dict[int, list] = {}
    for f in file_plan:
        p = f.get("priority", 99)
        priority_buckets.setdefault(p, []).append(f)

    for priority in sorted(priority_buckets.keys()):
        batch = priority_buckets[priority]

        # Semaphore limits concurrent Gemini API calls
        sem = asyncio.Semaphore(MAX_CONCURRENT_FILES)

        async def _generate_one(file_spec, _sem=sem):
            file_path = file_spec["path"]
            description = file_spec.get("description", "")

            # Build context from already-completed files
            context_snippets = []
            for dep_path in file_spec.get("depends_on", []):
                if dep_path in generated_files:
                    content = generated_files[dep_path]
                    context_snippets.append(f"### {dep_path}\n```\n{content[:600]}\n```")
            context_files = "\n".join(context_snippets) if context_snippets else "None yet."

            patch_section = ""
            if is_patch_mode and patch_feedback:
                patch_section = PATCH_SECTION_TEMPLATE.format(feedback=patch_feedback)

            prompt = DEVELOPER_AGENT_PROMPT.format(
                file_path=file_path,
                file_description=description,
                architecture_summary=arch_summary,
                tech_stack=json.dumps(tech_stack),
                context_files=context_files,
                patch_section=patch_section,
            )

            async with _sem:
                await _log(log, "AGENT_LOG", f"  ⚙️ Generating: {file_path}")
                try:
                    code_content = await generate_text(prompt)
                    return file_path, code_content, None
                except Exception as e:
                    return file_path, None, str(e)

        # Run the batch concurrently
        results = await asyncio.gather(*[_generate_one(f) for f in batch])

        for file_path, code_content, error in results:
            if error:
                await _log(log, "ERROR", f"  ❌ Failed to generate {file_path}: {error}")
                continue

            generated_files[file_path] = code_content

            if workspace_mgr:
                workspace_mgr.write_file(file_path, code_content)

            await _log(
                log, "FILE_WRITTEN",
                f"  ✅ {file_path} ({len(code_content)} chars)",
                metadata={"path": file_path, "size": len(code_content)}
            )

    await _log(
        log, "AGENT_DONE",
        f"✅ Developer complete: {len(generated_files)} files written"
    )

    return {
        "generated_files": generated_files,
        "patch_feedback": None,
    }


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
