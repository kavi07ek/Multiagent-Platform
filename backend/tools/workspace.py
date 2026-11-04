"""
Workspace Manager — handles per-run directory creation,
file writing, and ZIP generation.
"""

import io
import os
import shutil
import zipfile
from pathlib import Path


WORKSPACES_ROOT = Path(os.path.dirname(__file__)).parent / "workspaces"


class WorkspaceManager:
    def __init__(self, run_id: str):
        self.run_id = run_id
        self.workspace_dir = WORKSPACES_ROOT / run_id
        self.files: dict[str, str] = {}  # path → content

    def create_workspace(self) -> str:
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        return str(self.workspace_dir)

    def write_file(self, relative_path: str, content: str) -> str:
        """Write a file to the workspace. Returns absolute path."""
        target = self.workspace_dir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        self.files[relative_path] = content
        return str(target)

    def read_file(self, relative_path: str) -> str | None:
        """Read a file from the workspace."""
        target = self.workspace_dir / relative_path
        if target.exists():
            return target.read_text(encoding="utf-8")
        return None

    def list_files(self) -> list[str]:
        """Return all relative file paths in the workspace."""
        result = []
        if self.workspace_dir.exists():
            for f in self.workspace_dir.rglob("*"):
                if f.is_file():
                    result.append(str(f.relative_to(self.workspace_dir)).replace("\\", "/"))
        return result

    def get_all_files(self) -> dict[str, str]:
        """Return dict of all files {relative_path: content}."""
        result = {}
        for rel_path in self.list_files():
            content = self.read_file(rel_path)
            if content is not None:
                result[rel_path] = content
        return result

    def create_zip(self) -> bytes:
        """Create an in-memory ZIP of all workspace files."""
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for rel_path in self.list_files():
                abs_path = self.workspace_dir / rel_path
                zf.write(abs_path, rel_path)
        return buffer.getvalue()

    def cleanup(self):
        """Remove workspace directory."""
        if self.workspace_dir.exists():
            shutil.rmtree(self.workspace_dir)
