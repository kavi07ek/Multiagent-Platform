"""
Sandbox Runner — executes generated Python tests in an isolated subprocess.
Uses a per-run virtual environment for dependency isolation.
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path


SANDBOX_TIMEOUT = 30  # seconds


async def run_tests_in_sandbox(workspace_dir: str) -> dict:
    """
    Run pytest in an isolated subprocess within the given workspace directory.
    Returns a dict with {exit_code, stdout, stderr, passed, failed, errors}.
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

    # Create isolated venv for this run
    venv_dir = workspace_path / ".venv"
    venv_created = await _ensure_venv(venv_dir)

    python_exe = _get_venv_python(venv_dir)

    # Install dependencies if requirements.txt exists
    req_file = workspace_path / "requirements.txt"
    if req_file.exists() and venv_created:
        await _install_requirements(python_exe, str(req_file))

    # Always install pytest
    await _pip_install(python_exe, ["pytest", "pytest-asyncio"])

    # Run pytest
    cmd = [
        str(python_exe),
        "-m", "pytest",
        str(tests_dir),
        "-v",
        "--tb=short",
        "--no-header",
        "-q",
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
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Test execution timed out after {SANDBOX_TIMEOUT}s",
            "passed": 0,
            "failed": 0,
            "errors": 1,
            "summary": f"TIMEOUT after {SANDBOX_TIMEOUT}s",
        }

    # Parse results
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


def _get_venv_python(venv_dir: Path) -> Path:
    if sys.platform == "win32":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


async def _ensure_venv(venv_dir: Path) -> bool:
    """Create venv if it doesn't exist. Returns True if newly created."""
    if venv_dir.exists():
        return False
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "venv", str(venv_dir),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()
    return True


async def _pip_install(python_exe: Path, packages: list[str]):
    proc = await asyncio.create_subprocess_exec(
        str(python_exe), "-m", "pip", "install", "--quiet", *packages,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await asyncio.wait_for(proc.communicate(), timeout=60)


async def _install_requirements(python_exe: Path, req_file: str):
    proc = await asyncio.create_subprocess_exec(
        str(python_exe), "-m", "pip", "install", "--quiet", "-r", req_file,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await asyncio.wait_for(proc.communicate(), timeout=120)


def _parse_pytest_output(output: str) -> tuple[int, int, int]:
    """Parse pytest summary line to extract pass/fail/error counts."""
    import re
    passed = failed = errors = 0
    # Match patterns like "3 passed", "2 failed", "1 error"
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
