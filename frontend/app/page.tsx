"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import AgentPipeline from "@/components/AgentPipeline";
import LogStream from "@/components/LogStream";
import FileExplorer from "@/components/FileExplorer";
import DownloadButton from "@/components/DownloadButton";
import ReviewPanel from "@/components/ReviewPanel";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export type LogEntry = {
  type: string;
  agent: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type AgentStepStatus = "idle" | "active" | "done" | "error";

export type PipelineState = {
  pm: AgentStepStatus;
  architect: AgentStepStatus;
  developer: AgentStepStatus;
  qa: AgentStepStatus;
  reviewer: AgentStepStatus;
  reviewIteration: number;
};

const EXAMPLE_SPECS = [
  "Build a REST API for a todo list with CRUD operations using FastAPI and SQLite",
  "Create a Python CLI tool for scraping and summarizing news articles",
  "Build a URL shortener service with click tracking and analytics dashboard",
];

const INITIAL_PIPELINE: PipelineState = {
  pm: "idle",
  architect: "idle",
  developer: "idle",
  qa: "idle",
  reviewer: "idle",
  reviewIteration: 0,
};

export default function Dashboard() {
  const [spec, setSpec] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pipeline, setPipeline] = useState<PipelineState>(INITIAL_PIPELINE);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [reviewResult, setReviewResult] = useState<Record<string, unknown> | null>(null);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const toastId = useRef(0);

  const addToast = useCallback((type: string, msg: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, type, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // Parse agent log events to update pipeline state
  const updatePipelineFromLog = useCallback((entry: LogEntry) => {
    const agent = entry.agent?.toLowerCase() || "";
    const type = entry.type;

    setPipeline((prev) => {
      const next = { ...prev };

      if (agent.includes("product manager") || agent.includes("pm")) {
        if (type === "AGENT_START") next.pm = "active";
        else if (type === "AGENT_DONE") next.pm = "done";
        else if (type === "ERROR") next.pm = "error";
      } else if (agent.includes("architect")) {
        if (type === "AGENT_START") next.architect = "active";
        else if (type === "AGENT_DONE") next.architect = "done";
        else if (type === "ERROR") next.architect = "error";
      } else if (agent.includes("developer")) {
        if (type === "AGENT_START") next.developer = "active";
        else if (type === "AGENT_DONE") next.developer = "done";
        else if (type === "ERROR") next.developer = "error";
      } else if (agent.includes("qa")) {
        if (type === "AGENT_START") next.qa = "active";
        else if (type === "AGENT_DONE") next.qa = "done";
        else if (type === "ERROR") next.qa = "error";
      } else if (agent.includes("reviewer")) {
        if (type === "AGENT_START") next.reviewer = "active";
        else if (type === "AGENT_DONE") next.reviewer = "done";
        else if (type === "ERROR") next.reviewer = "error";
        if (type === "AGENT_START" && prev.reviewer === "done") {
          next.reviewIteration = prev.reviewIteration + 1;
          next.developer = "active";
        }
      }

      return next;
    });
  }, []);

  const startRun = useCallback(async () => {
    if (!spec.trim() || isRunning) return;

    // Reset state
    setLogs([]);
    setFiles({});
    setReviewResult(null);
    setPipeline(INITIAL_PIPELINE);
    setRunStatus("running");
    setIsRunning(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specification: spec }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const newRunId = data.run_id;
      setRunId(newRunId);

      // Connect SSE stream
      if (eventSourceRef.current) eventSourceRef.current.close();

      const es = new EventSource(`${BACKEND_URL}/api/stream/${newRunId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const entry: LogEntry & { status?: string; files?: Record<string, string>; review?: Record<string, unknown> } =
          JSON.parse(event.data);

        if (entry.type === "DONE") {
          setRunStatus(entry.status === "completed" ? "completed" : "failed");
          setIsRunning(false);
          es.close();
          // Fetch final files
          fetchFiles(newRunId);
          if (entry.status === "completed") {
            addToast("success", "✅ Pipeline completed successfully!");
          } else {
            addToast("error", "❌ Pipeline encountered errors.");
          }
          return;
        }

        if (entry.type === "HEARTBEAT") return;

        setLogs((prev) => [...prev, entry]);
        updatePipelineFromLog(entry);

        // Capture review result from metadata
        if (entry.agent?.includes("Reviewer") && entry.type === "AGENT_DONE" && entry.metadata) {
          setReviewResult(entry.metadata);
        }
      };

      es.onerror = () => {
        setIsRunning(false);
        setRunStatus("failed");
        es.close();
        addToast("error", "❌ Connection to pipeline lost.");
      };
    } catch (err: unknown) {
      setIsRunning(false);
      setRunStatus("failed");
      const msg = err instanceof Error ? err.message : String(err);
      addToast("error", `Failed to start pipeline: ${msg}`);
    }
  }, [spec, isRunning, updatePipelineFromLog, addToast]);

  const fetchFiles = useCallback(async (rid: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/files/${rid}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || {});
        if (data.result?.review_result) {
          setReviewResult(data.result.review_result);
        }
      }
    } catch {
      // Silently fail — files might not be ready yet
    }
  }, []);

  // Poll for files if run completes but SSE doesn't send them
  useEffect(() => {
    if (runStatus === "completed" && runId && Object.keys(files).length === 0) {
      fetchFiles(runId);
    }
  }, [runStatus, runId, files, fetchFiles]);

  // Cleanup on unmount
  useEffect(() => () => eventSourceRef.current?.close(), []);

  const progressPercent = (() => {
    const steps = [pipeline.pm, pipeline.architect, pipeline.developer, pipeline.qa, pipeline.reviewer];
    const done = steps.filter((s) => s === "done").length;
    const active = steps.some((s) => s === "active") ? 0.5 : 0;
    return Math.round(((done + active) / 5) * 100);
  })();

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">AgentForge</span>
        </div>
        <span className="header-badge">Multi-Agent Platform v1.0</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {runStatus === "completed" && runId && (
            <DownloadButton runId={runId} backendUrl={BACKEND_URL} fileCount={Object.keys(files).length} />
          )}
          {runStatus !== "idle" && (
            <span className="header-badge" style={{ color: runStatus === "completed" ? "var(--accent-green)" : runStatus === "failed" ? "var(--accent-red)" : "var(--accent-blue)" }}>
              {runStatus === "running" ? "⚙ RUNNING" : runStatus === "completed" ? "✅ DONE" : "❌ FAILED"}
            </span>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="hero">
        <div className="hero-eyebrow">Powered by LangGraph + Gemini 2.0 Flash</div>
        <h1>Autonomous Software<br />Engineering Platform</h1>
        <p className="hero-desc">
          Describe what you want to build. Our 5-agent AI pipeline will architect,
          code, test, and review it for you — end to end.
        </p>
      </div>

      {/* Progress bar */}
      {runStatus === "running" && (
        <div className="progress-bar-wrapper" style={{ margin: "0 2rem 1rem" }}>
          <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {/* Main grid */}
      <div className="main-grid">
        {/* Spec Input — full width */}
        <div className="glass-card spec-panel">
          <div className="card-header">
            <div className="card-title">
              <span className="card-title-icon">📝</span>
              Project Specification
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {spec.length} / 8000
            </div>
          </div>
          <div className="spec-form">
            <textarea
              id="spec-input"
              className="spec-textarea"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="Describe what you want to build in plain English...&#10;&#10;Example: Build a REST API for a todo list with CRUD operations, user authentication with JWT, and a SQLite database. Include input validation and error handling."
              disabled={isRunning}
              maxLength={8000}
            />
            <div className="spec-footer">
              <div className="example-chips">
                {EXAMPLE_SPECS.map((ex) => (
                  <button
                    key={ex}
                    className="chip"
                    onClick={() => setSpec(ex)}
                    disabled={isRunning}
                    title={ex}
                  >
                    {ex.slice(0, 40)}…
                  </button>
                ))}
              </div>
              <button
                id="run-pipeline-btn"
                className="btn-primary"
                onClick={startRun}
                disabled={isRunning || spec.trim().length < 10}
              >
                {isRunning ? (
                  <>
                    <span className="spinner" />
                    Running Pipeline...
                  </>
                ) : (
                  <>⚡ Run Pipeline</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Agent Pipeline */}
        <div className="glass-card" style={{ gridRow: "span 1" }}>
          <div className="card-header">
            <div className="card-title">
              <span className="card-title-icon">🤖</span>
              Agent Pipeline
            </div>
            {pipeline.reviewIteration > 0 && (
              <span className="loop-badge">🔄 Review loop #{pipeline.reviewIteration}</span>
            )}
          </div>
          <div className="pipeline-body">
            <AgentPipeline pipeline={pipeline} />
          </div>
        </div>

        {/* Log Stream */}
        <div className="glass-card log-panel">
          <div className="card-header">
            <div className="card-title">
              <span className="card-title-icon">📡</span>
              Live Agent Logs
            </div>
            <span className={`status-dot ${isRunning ? "streaming" : runStatus === "completed" ? "done" : runStatus === "failed" ? "error" : ""}`}>
              {isRunning ? "streaming" : runStatus}
            </span>
          </div>
          <LogStream logs={logs} isStreaming={isRunning} />
        </div>

        {/* File Explorer */}
        <div className="glass-card explorer-panel">
          <div className="card-header">
            <div className="card-title">
              <span className="card-title-icon">📁</span>
              Generated Files
            </div>
            {Object.keys(files).length > 0 && (
              <span style={{ fontSize: "0.72rem", color: "var(--accent-green)" }}>
                {Object.keys(files).length} files
              </span>
            )}
          </div>
          <FileExplorer files={files} />
        </div>

        {/* Review Panel — shown when review data available */}
        {reviewResult && (
          <div className="glass-card review-panel">
            <div className="card-header">
              <div className="card-title">
                <span className="card-title-icon">🔍</span>
                Code Review Report
              </div>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: reviewResult.status === "PASS" ? "var(--accent-green)" : "var(--accent-red)"
              }}>
                {reviewResult.status === "PASS" ? "✅ PASSED" : "❌ FAILED"}
              </span>
            </div>
            <ReviewPanel review={reviewResult} />
          </div>
        )}
      </div>

      {/* Toast container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
