"""
Sandbox Runner — executes generated Python tests in an isolated subprocess.

Speed optimizations:
- Shared base venv cached at backend/workspaces/.shared_venv (created once,
  reused across all runs) with pytest pre-installed.
- Per-run requirements installed only when requirements.txt is present and
  not already satisfied (using pip install --no-deps where possible).
- Reduced timeout to avoid hanging tests blocking the pipeline.
"""

import asyncio
import os
import sys
from pathlib import Path

SANDBOX_TIMEOUT = 15   # seconds for test execution (down from 20)
_PIP_INSTALL_TIMEOUT = 45   # pip install timeout

# Packages already in the shared venv — skip re-installing these
_PREINSTALLED = frozenset([
    "fastapi", "uvicorn", "pydantic", "httpx", "pytest",
    "pytest-asyncio", "anyio", "starlette",
])

# Shared venv is stored once alongside workspaces/ to be reused per run
_SHARED_VENV_DIR: Path | None = None


def _get_shared_venv_dir() -> Path:
    global _SHARED_VENV_DIR
    if _SHARED_VENV_DIR is None:
        # Place it next to the workspaces directory (backend/.shared_venv)
        backend_dir = Path(__file__).parent.parent
        _SHARED_VENV_DIR = backend_dir / "workspaces" / ".shared_venv"
    return _SHARED_VENV_DIR


def _get_venv_python(venv_dir: Path) -> Path:
    if sys.platform == "win32":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


async def _ensure_shared_venv() -> Path:
    """
    Ensure the shared base venv exists with pytest pre-installed.
    Returns the path to the Python executable in that venv.
    Fast no-op after first call since the directory already exists.
    """
    venv_dir = _get_shared_venv_dir()
    python_exe = _get_venv_python(venv_dir)

    if not python_exe.exists():
        # Create the venv (once per server lifetime)
        venv_dir.mkdir(parents=True, exist_ok=True)
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "venv", str(venv_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=60)

        # Pre-install test tooling once
        await _pip_install(python_exe, ["fastapi", "uvicorn", "pydantic", "httpx",
                                         "pytest", "pytest-asyncio", "anyio"])

    return python_exe


async def run_tests_in_sandbox(workspace_dir: str) -> dict:
    """
    Run pytest in an isolated subprocess inside the given workspace directory.
    Returns a dict with {exit_code, stdout, stderr, passed, failed, errors, summary}.
    """
    workspace_path = Path(workspace_dir)
    tests_dir = workspace_path / "tests"

    if not tests_dir.exists():
        return {
            "exit_code": -1,
            "stdout": "",
            "stderr": "No tests directory found.",
            "passed": 0,
            "failed": 0,
            "errors": 0,
            "summary": "No tests to run.",
        }

    # Use the shared venv (fast path after first creation)
    try:
        python_exe = await _ensure_shared_venv()
    except Exception as e:
        return {
            "exit_code": -1, "stdout": "", "stderr": f"Venv setup failed: {e}",
            "passed": 0, "failed": 0, "errors": 1,
            "summary": f"Sandbox init failed: {e}",
        }

    # Install any extra project-specific requirements (skip pre-installed ones)
    req_file = workspace_path / "requirements.txt"
    if req_file.exists():
        try:
            # Read requirements and filter out already-installed packages
            lines = req_file.read_text().splitlines()
            extra = [
                ln.strip() for ln in lines
                if ln.strip() and not ln.startswith("#")
                and ln.split(">=")[0].split("==")[0].strip().lower() not in _PREINSTALLED
            ]
            if extra:
                await asyncio.wait_for(
                    _pip_install(python_exe, extra),
                    timeout=_PIP_INSTALL_TIMEOUT,
                )
        except asyncio.TimeoutError:
            pass  # Skip if requirements install hangs; tests may still pass

    # Run pytest with minimal output, stop at first failure for speed
    cmd = [
        str(python_exe), "-m", "pytest",
        str(tests_dir),
        "--tb=short",
        "--no-header",
        "-q",
        "-x",             # stop at first failure — no point running all tests if one breaks
        "--timeout=8",    # per-test timeout (needs pytest-timeout, ignored if absent)
        "-p", "no:warnings",   # suppress warnings output — faster
        "--no-cov",       # never run coverage (slow) even if pytest-cov is installed
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(workspace_path),
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=SANDBOX_TIMEOUT
        )
        exit_code = proc.returncode
        stdout_str = stdout.decode("utf-8", errors="replace")
        stderr_str = stderr.decode("utf-8", errors="replace")

    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        return {
            "exit_code": -1, "stdout": "", "stderr": f"Test execution timed out after {SANDBOX_TIMEOUT}s",
            "passed": 0, "failed": 0, "errors": 1,
            "summary": f"TIMEOUT after {SANDBOX_TIMEOUT}s",
        }

    passed, failed, errors = _parse_pytest_output(stdout_str)
    return {
        "exit_code": exit_code,
        "stdout": stdout_str,
        "stderr": stderr_str,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "summary": f"{passed} passed, {failed} failed, {errors} errors",
    }


async def _pip_install(python_exe: Path, packages: list[str]):
    proc = await asyncio.create_subprocess_exec(
        str(python_exe), "-m", "pip", "install", "--quiet", "--no-warn-script-location",
        *packages,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await asyncio.wait_for(proc.communicate(), timeout=_PIP_INSTALL_TIMEOUT)


def _parse_pytest_output(output: str) -> tuple[int, int, int]:
    """Parse pytest summary line to extract pass/fail/error counts."""
    import re
    passed = failed = errors = 0
    m_passed = re.search(r"(\d+) passed", output)
    m_failed = re.search(r"(\d+) failed", output)
    m_error = re.search(r"(\d+) error", output)
    if m_passed:
        passed = int(m_passed.group(1))
    if m_failed:
        failed = int(m_failed.group(1))
    if m_error:
        errors = int(m_error.group(1))
    return passed, failed, errors
