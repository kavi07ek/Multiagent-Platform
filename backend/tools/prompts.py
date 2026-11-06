"""
All agent prompt templates for the Multi-Agent Platform.
Prompts are ultra-compact to minimize token usage and maximize LLM speed.
"""

PM_AGENT_PROMPT = """You are a PM. Output ONLY this JSON for the given requirement:
{{"title":"str","overview":"1 sentence","functional_requirements":[{{"id":"FR-1","title":"str","description":"str"}}],"non_functional_requirements":[{{"category":"str","requirement":"str"}}],"user_stories":[{{"as_a":"str","i_want_to":"str","so_that":"str"}}]}}
Keep it concise. Max 4 FRs, 2 NFRs, 2 user stories.
Requirement: {requirement}"""


ARCHITECT_AGENT_PROMPT = """You are an Architect. Output ONLY this JSON for the given PRD:
{{"architecture_summary":"1 sentence","tech_stack":{{"language":"Python 3.11","framework":"FastAPI","database":"in-memory dict (no SQLite/DB)","testing":"pytest"}},"api_endpoints":[{{"method":"str","path":"str","description":"str"}}],"file_plan":[{{"path":"str","description":"str","depends_on":[],"priority":1}}]}}
Rules:
- ALWAYS use Python + FastAPI + pytest (required for sandbox testing).
- ALWAYS use a plain Python dict/list for storage — NO sqlite3, NO SQLAlchemy, NO external DB.
- Max 4 files. No test files in file_plan. Priority=1 = no deps, 2,3... for dependents.
- Output JSON only.
PRD title: {prd_title}
Requirements: {prd_summary}"""


DEVELOPER_AGENT_PROMPT = """Write file `{file_path}`.
Desc: {file_description}
Stack: {tech_stack}
Arch: {architecture_summary}
Existing files: {context_files}
{patch_section}
Rules:
- Output ONLY raw file content. No markdown fences. Production-ready code, type hints, error handling.
- Storage: use a module-level Python dict or list — NO sqlite3, NO SQLAlchemy, NO external database.
- Use `from fastapi import FastAPI` and return JSON responses."""

PATCH_SECTION_TEMPLATE = """PATCH: Fix these issues only:
{feedback}"""

QA_AGENT_PROMPT = """You are QA. Write pytest tests for the Python/FastAPI project. Output ONLY:
{{"test_plan":"1 sentence","test_files":[{{"path":"tests/test_api.py","content":"complete pytest file"}}]}}
Rules:
- Use FastAPI TestClient (`from fastapi.testclient import TestClient`).
- Import `app` from `main` (e.g. `from main import app`).
- Test happy path + 1 error case per endpoint.
- No external service calls, no database needed (use in-memory).
- Output JSON only.
Source files: {source_files}"""


REVIEWER_AGENT_PROMPT = """Quick code review. Output ONLY:
{{"status":"PASS|FAIL","overall_score":0-100,"summary":"1 sentence","positives":["str"],"issues":[{{"severity":"CRITICAL|HIGH|MEDIUM|LOW","file":"str","description":"str","fix_suggestion":"str"}}],"patch_instructions":"str|null"}}
PASS = no CRITICAL + score>=70. FAIL = any CRITICAL or score<70.
Files: {all_files}
Tests: {test_results}"""
