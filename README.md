# AgentForge — Autonomous Multi-Agent Software Engineering Platform

> Transform plain-English requirements into production-ready, tested, reviewed code using a 5-agent AI pipeline.

![Stack](https://img.shields.io/badge/LangGraph-0.2+-blue) ![Stack](https://img.shields.io/badge/Gemini-2.0_Flash-orange) ![Stack](https://img.shields.io/badge/FastAPI-0.115+-green) ![Stack](https://img.shields.io/badge/Next.js-14-black)

---

## Architecture

```
User Spec → [PM Agent] → [Architect Agent] → [Developer Agent] → [QA Agent] → [Reviewer Agent]
                                                     ↑                                  |
                                                     └──────── FAIL (patch loop) ───────┘
```

### The 5 Agents

| Agent | Role | Output |
|-------|------|--------|
| **Product Manager** | Parses NL spec → structured PRD | JSON PRD with requirements & user stories |
| **System Architect** | Designs system → architecture | Tech stack, DB schema, API endpoints, file plan |
| **Developer** | Implements code file-by-file | Production Python/JS/TS source files |
| **QA Engineer** | Writes tests → runs in sandbox | pytest files + test results |
| **Code Reviewer** | Audits code → PASS/FAIL | Security/perf/quality report + patch feedback |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Google Gemini API Key](https://makersuite.google.com/app/apikey)

### 1. Backend Setup

```bash
cd backend

# Copy and fill in your API key
cp .env.example .env
# Edit .env: GEMINI_API_KEY=your_key_here

# Create virtual environment
python -m venv .venv

# Activate (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the server
python -m uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (already done if you ran npm install)
npm install

# Start the dev server
npm run dev
```

### 3. Open the Dashboard

Navigate to **http://localhost:3000**

---

## Usage

1. **Enter your specification** in the text area (plain English)
2. **Click "Run Pipeline"** — the 5 agents will execute in sequence
3. **Watch the live logs** stream in real-time as each agent works
4. **Inspect generated files** in the file explorer, click to preview
5. **Download the ZIP** of the complete generated codebase

### Example Specs to Try

- *"Build a REST API for a todo list with CRUD operations using FastAPI and SQLite"*
- *"Create a Python CLI tool for scraping and summarizing news articles with BeautifulSoup"*
- *"Build a URL shortener service with click tracking and Redis caching"*

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/run` | POST | Start a new pipeline run |
| `GET /api/stream/{run_id}` | GET | SSE stream of agent log events |
| `GET /api/files/{run_id}` | GET | Get all generated files as JSON |
| `GET /api/zip/{run_id}` | GET | Download ZIP of generated project |
| `GET /api/runs/{run_id}/status` | GET | Get current run status |

---

## Project Structure

```
multiagent-platform/
├── backend/
│   ├── main.py                    # FastAPI app + SSE + ZIP endpoints
│   ├── requirements.txt
│   ├── orchestrator/
│   │   ├── graph.py               # LangGraph StateGraph + review loop
│   │   ├── state.py               # AgentState TypedDict
│   │   └── nodes/
│   │       ├── pm_agent.py        # Product Manager
│   │       ├── architect_agent.py # System Architect
│   │       ├── developer_agent.py # Developer (+ patch mode)
│   │       ├── qa_agent.py        # QA Engineer + sandbox runner
│   │       └── reviewer_agent.py  # Code Reviewer
│   └── tools/
│       ├── gemini_client.py       # Gemini 2.0 Flash API wrapper
│       ├── sandbox.py             # Isolated venv test runner
│       ├── workspace.py           # Per-run file workspace
│       └── prompts.py             # All LLM prompt templates
└── frontend/
    ├── app/
    │   ├── page.tsx               # Main dashboard
    │   └── globals.css            # Dark glassmorphism design system
    └── components/
        ├── AgentPipeline.tsx      # Visual 5-step pipeline
        ├── LogStream.tsx          # Real-time SSE terminal
        ├── FileExplorer.tsx       # Generated file tree + preview
        ├── ReviewPanel.tsx        # Code review report
        └── DownloadButton.tsx     # ZIP download
```

---

## Configuration

### Review Loop Settings

In `backend/orchestrator/graph.py`:
```python
MAX_REVIEW_ITERATIONS = 3  # Max times reviewer sends code back to developer
```

### LLM Model

In `backend/tools/gemini_client.py`:
```python
# Default model for all agents
model = "gemini-2.0-flash"

# For more complex reasoning (Architect/Reviewer):
model = "gemini-2.0-flash-thinking-exp"
```

### Sandbox Timeout

In `backend/tools/sandbox.py`:
```python
SANDBOX_TIMEOUT = 30  # seconds for test execution
```

---

## License

MIT
