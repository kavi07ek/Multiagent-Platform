"use client";

import { useState } from "react";

interface FileExplorerProps {
  files: Record<string, string>;
}

const getFileIcon = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    py: "🐍", ts: "🔷", tsx: "⚛️", js: "🟡", jsx: "⚛️",
    json: "📋", md: "📝", txt: "📄", yml: "⚙️", yaml: "⚙️",
    toml: "⚙️", css: "🎨", html: "🌐", sh: "📜", sql: "🗄️",
    env: "🔐", gitignore: "🔧", dockerfile: "🐳",
  };
  return icons[ext] || "📄";
};

const buildTree = (files: Record<string, string>): Record<string, string[]> => {
  const tree: Record<string, string[]> = { "": [] };
  Object.keys(files).forEach((path) => {
    const parts = path.split("/");
    if (parts.length === 1) {
      tree[""].push(path);
    } else {
      const dir = parts.slice(0, -1).join("/");
      if (!tree[dir]) tree[dir] = [];
      tree[dir].push(path);
    }
  });
  return tree;
};

export default function FileExplorer({ files }: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fileCount = Object.keys(files).length;

  if (fileCount === 0) {
    return (
      <div className="explorer-body">
        <div className="file-empty">
          <div className="file-empty-icon">📁</div>
          <span>Generated files will appear here</span>
        </div>
      </div>
    );
  }

  const openFile = (path: string) => {
    setSelectedFile(path);
    setModalOpen(true);
  };

  // Group files by directory
  const dirs: Record<string, string[]> = {};
  const rootFiles: string[] = [];

  Object.keys(files)
    .sort()
    .forEach((path) => {
      const parts = path.split("/");
      if (parts.length === 1) {
        rootFiles.push(path);
      } else {
        const dir = parts.slice(0, -1).join("/");
        if (!dirs[dir]) dirs[dir] = [];
        dirs[dir].push(path);
      }
    });

  return (
    <>
      <div className="explorer-body">
        <ul className="file-tree">
          {/* Root files */}
          {rootFiles.map((path) => (
            <li
              key={path}
              id={`file-${path.replace(/[^a-zA-Z0-9]/g, "-")}`}
              className={`file-item ${selectedFile === path ? "active" : ""}`}
              onClick={() => openFile(path)}
            >
              <span className="file-icon">{getFileIcon(path)}</span>
              {path}
            </li>
          ))}

          {/* Directories */}
          {Object.entries(dirs)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dir, dirFiles]) => (
              <li key={dir}>
                <div className="dir-item">📂 {dir}/</div>
                <ul className="file-tree" style={{ paddingLeft: "12px" }}>
                  {dirFiles.map((path) => {
                    const name = path.split("/").pop()!;
                    return (
                      <li
                        key={path}
                        id={`file-${path.replace(/[^a-zA-Z0-9]/g, "-")}`}
                        className={`file-item ${selectedFile === path ? "active" : ""}`}
                        onClick={() => openFile(path)}
                      >
                        <span className="file-icon">{getFileIcon(name)}</span>
                        {name}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
        </ul>
      </div>

      {/* File Preview Modal */}
      {modalOpen && selectedFile && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-filename">
                  {getFileIcon(selectedFile)} {selectedFile}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  {files[selectedFile]?.length || 0} characters
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  onClick={() => {
                    navigator.clipboard.writeText(files[selectedFile] || "");
                  }}
                >
                  📋 Copy
                </button>
                <button className="modal-close" onClick={() => setModalOpen(false)}>
                  ✕
                </button>
              </div>
            </div>
            <div className="modal-body">
              <pre className="code-block">{files[selectedFile]}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
