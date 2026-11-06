"""
All agent prompt templates for the Multi-Agent Platform.
Prompts are ultra-compact to minimize token usage and maximize LLM speed.
"""

PM_AGENT_PROMPT = """You are a PM. Output ONLY this JSON for the given requirement:
{{"title":"str","overview":"1 sentence","functional_requirements":[{{"id":"FR-1","title":"str","description":"str"}}],"non_functional_requirements":[{{"category":"str","requirement":"str"}}],"user_stories":[{{"as_a":"str","i_want_to":"str","so_that":"str"}}]}}
Keep it concise. Max 4 FRs, 2 NFRs, 2 user stories.
Requirement: {requirement}"""


ARCHITECT_AGENT_PROMPT = """You are an Architect. Output ONLY this JSON for the given PRD:
{{"architecture_summary":"1 sentence","tech_stack":{{"language":"str","framework":"str","database":"str","testing":"str"}},"api_endpoints":[{{"method":"str","path":"str","description":"str"}}],"file_plan":[{{"path":"str","description":"str","depends_on":[],"priority":1}}]}}
Rules: Max 4 files. No test files. Priority=1 first (no deps), then 2,3... Output JSON only.
PRD title: {prd_title}
Requirements: {prd_summary}"""


DEVELOPER_AGENT_PROMPT = """Write file `{file_path}`.
Desc: {file_description}
Stack: {tech_stack}
Arch: {architecture_summary}
Existing files: {context_files}
{patch_section}
Output ONLY raw file content. No markdown fences. Production-ready code, type hints, error handling."""

PATCH_SECTION_TEMPLATE = """PATCH: Fix these issues only:
{feedback}"""

QA_AGENT_PROMPT = """You are QA. Write pytest tests. Output ONLY:
{{"test_plan":"1 sentence","test_files":[{{"path":"tests/test_X.py","content":"complete pytest file"}}]}}
Rules: happy path + 1 error case per endpoint. Use FastAPI TestClient. No external service mocks. JSON only.
Source: {source_files}
Stack: {architecture}"""


REVIEWER_AGENT_PROMPT = """Quick code review. Output ONLY:
{{"status":"PASS|FAIL","overall_score":0-100,"summary":"1 sentence","positives":["str"],"issues":[{{"severity":"CRITICAL|HIGH|MEDIUM|LOW","file":"str","description":"str","fix_suggestion":"str"}}],"patch_instructions":"str|null"}}
PASS = no CRITICAL + score>=70. FAIL = any CRITICAL or score<70.
Files: {all_files}
Tests: {test_results}"""
