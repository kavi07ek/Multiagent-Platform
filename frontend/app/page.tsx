"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AgentPipeline from "@/components/AgentPipeline";
import LogStream from "@/components/LogStream";
import FileExplorer from "@/components/FileExplorer";
import DownloadButton from "@/components/DownloadButton";
import ReviewPanel from "@/components/ReviewPanel";
import ProfileButton from "@/components/ProfileButton";
import { saveRunToSupabase, getSupabaseCredentials } from "@/lib/supabase";

// Dynamic backend URL resolver to allow seamless access from any device on the same Wi-Fi
function getBackendUrl(): string {
  if (typeof window !== "undefined" && window.location.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
}

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
  const router = useRouter();

  // Auth gating state
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("user@agentforge.ai");
  const [isSupabaseDbActive, setIsSupabaseDbActive] = useState(false);

  const [spec, setSpec] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pipeline, setPipeline] = useState<PipelineState>(INITIAL_PIPELINE);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [reviewResult, setReviewResult] = useState<Record<string, unknown> | null>(null);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed" | "cancelled">("idle");
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);
  // Process is only visible once the user clicks "Run Pipeline"
  const [hasStarted, setHasStarted] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const toastId = useRef(0);
  const processSectionRef = useRef<HTMLDivElement | null>(null);

  // First get login: Check authentication on mount
  useEffect(() => {
    try {
      const userStr = localStorage.getItem("agentforge_user") || sessionStorage.getItem("agentforge_user");
      if (!userStr) {
        // Redirect to login page first
        router.replace("/login");
        return;
      }
      const parsed = JSON.parse(userStr);
      if (!parsed?.email && !parsed?.username) {
        router.replace("/login");
        return;
      }
      setUserEmail(parsed.email || `${parsed.username}@agentforge.ai`);
      setIsAuthenticated(true);
    } catch {
      router.replace("/login");
    } finally {
      setIsCheckingAuth(false);
    }

    // Check Supabase connection
    const creds = getSupabaseCredentials();
    setIsSupabaseDbActive(creds.isConfigured);
  }, [router]);

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

  const cancelRun = useCallback(async () => {
    if (!runId || !isRunning) return;
    const backendUrl = getBackendUrl();
    setIsCancelling(true);
    try {
      const response = await fetch(`${backendUrl}/api/runs/${runId}/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        await fetch(`${backendUrl}/api/cancel/${runId}`, { method: "POST" });
      }
      addToast("info", "⏹ Pipeline cancellation requested...");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast("error", `Failed to cancel pipeline: ${msg}`);
    } finally {
      setIsCancelling(false);
    }
  }, [runId, isRunning, addToast]);

  const startRun = useCallback(async () => {
    if (!spec.trim() || isRunning) return;

    // Reveal process section immediately on click
    setHasStarted(true);
    setLogs([]);
    setFiles({});
    setReviewResult(null);
    setPipeline(INITIAL_PIPELINE);
    setRunStatus("running");
    setIsRunning(true);
    setIsCancelling(false);

    // Smooth scroll down to process area
    setTimeout(() => {
      processSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    const backendUrl = getBackendUrl();

    try {
      const response = await fetch(`${backendUrl}/api/run`, {
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

      // Save initial run info to Supabase database
      saveRunToSupabase({
        id: newRunId,
        user_email: userEmail,
        specification: spec,
        status: "running",
      });

      // Connect SSE stream
      if (eventSourceRef.current) eventSourceRef.current.close();

      const es = new EventSource(`${backendUrl}/api/stream/${newRunId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const entry: LogEntry & { status?: string; files?: Record<string, string>; review?: Record<string, unknown> } =
          JSON.parse(event.data);

        if (entry.type === "CANCELLED") {
          setRunStatus("cancelled");
          setIsRunning(false);
          setPipeline((prev) => ({
            ...prev,
            pm: prev.pm === "active" ? "idle" : prev.pm,
            architect: prev.architect === "active" ? "idle" : prev.architect,
            developer: prev.developer === "active" ? "idle" : prev.developer,
            qa: prev.qa === "active" ? "idle" : prev.qa,
            reviewer: prev.reviewer === "active" ? "idle" : prev.reviewer,
          }));
          addToast("info", "⏹ Pipeline execution was cancelled.");

          // Update Supabase database record
          saveRunToSupabase({
            id: newRunId,
            user_email: userEmail,
            specification: spec,
            status: "cancelled",
          });
        }

        if (entry.type === "DONE") {
          if (entry.status === "cancelled") {
            setRunStatus("cancelled");
            setIsRunning(false);
            es.close();
            addToast("info", "⏹ Pipeline cancelled.");
            return;
          }

          setRunStatus(entry.status === "completed" ? "completed" : "failed");
          setIsRunning(false);
          es.close();

          // Fetch final files
          fetchFiles(newRunId);

          // Update Supabase database record
          saveRunToSupabase({
            id: newRunId,
            user_email: userEmail,
            specification: spec,
            status: entry.status === "completed" ? "completed" : "failed",
          });

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
  }, [spec, isRunning, userEmail, updatePipelineFromLog, addToast]);

  const fetchFiles = useCallback(async (rid: string) => {
    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/files/${rid}`);
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

  const resetToHome = () => {
    if (isRunning) return;
    setHasStarted(false);
    setRunStatus("idle");
    setLogs([]);
    setFiles({});
    setReviewResult(null);
    setPipeline(INITIAL_PIPELINE);
  };

  const progressPercent = (() => {
    const steps = [pipeline.pm, pipeline.architect, pipeline.developer, pipeline.qa, pipeline.reviewer];
    const done = steps.filter((s) => s === "done").length;
    const active = steps.some((s) => s === "active") ? 0.5 : 0;
    return Math.round(((done + active) / 5) * 100);
  })();

  const isProcessVisible = hasStarted || runStatus !== "idle" || logs.length > 0;

  // Gating view: If verifying authentication, don't show the dashboard yet
  if (isCheckingAuth || !isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="glass-card"
          style={{
            padding: "2.5rem 3rem",
            textAlign: "center",
            maxWidth: "420px",
            width: "90%",
            border: "1px solid var(--border-accent)",
            boxShadow: "var(--shadow-glow-blue)",
          }}
        >
          <div
            className="spinner"
            style={{
              margin: "0 auto 1.5rem",
              width: "36px",
              height: "36px",
              borderTopColor: "var(--accent-blue)",
            }}
          />
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Authenticating Session
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            Please login first to enter the AgentForge platform...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">AgentForge</span>
        </div>
        <span className="header-badge">Multi-Agent Platform v1.0</span>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: isSupabaseDbActive ? "var(--accent-green)" : "var(--accent-cyan)",
              background: isSupabaseDbActive ? "rgba(104, 211, 145, 0.08)" : "rgba(118, 228, 247, 0.08)",
              border: `1px solid ${isSupabaseDbActive ? "rgba(104, 211, 145, 0.25)" : "rgba(118, 228, 247, 0.25)"}`,
              padding: "3px 10px",
              borderRadius: "12px",
            }}
            title={isSupabaseDbActive ? "Connected to Supabase" : "Supabase configured"}
          >
            {isSupabaseDbActive ? "🗄️ Supabase Connected" : "🗄️ Supabase DB"}
          </span>

          <Link href="/login" className="login-header-btn">
            <span>Switch Account</span>
          </Link>

          {runStatus === "completed" && runId && (
            <DownloadButton runId={runId} backendUrl={getBackendUrl()} fileCount={Object.keys(files).length} />
          )}

          {runStatus !== "idle" && (
            <span
              className="header-badge"
              style={{
                color:
                  runStatus === "completed"
                    ? "var(--accent-green)"
                    : runStatus === "failed"
                    ? "var(--accent-red)"
                    : runStatus === "cancelled"
                    ? "var(--accent-orange)"
                    : "var(--accent-blue)",
              }}
            >
              {runStatus === "running"
                ? "⚙ RUNNING"
                : runStatus === "completed"
                ? "✅ DONE"
                : runStatus === "cancelled"
                ? "⏹ CANCELLED"
                : "❌ FAILED"}
            </span>
          )}

          {isRunning && (
            <button
              id="cancel-header-btn"
              type="button"
              className="btn-cancel-header"
              onClick={cancelRun}
              disabled={isCancelling}
              title="Cancel the running pipeline"
            >
              {isCancelling ? "Cancelling…" : "⏹ Cancel"}
            </button>
          )}

          <ProfileButton />
        </div>
      </header>

      {/* Hero */}
      <div className="hero">
        <div className="hero-eyebrow">Powered by LangGraph + Gemini 3.8 Flash + Supabase</div>
        <h1>Autonomous Software<br />Engineering Platform</h1>
        <p className="hero-desc">
          Describe what you want to build. Our 5-agent AI pipeline will architect,
          code, test, and review it for you — end to end.
        </p>
      </div>

      {/* Preparing the program banner & Progress bar (only when running) */}
      {runStatus === "running" && (
        <>
          <div className="preparing-banner">
            <div className="preparing-left">
              <span className="spinner" style={{ width: "16px", height: "16px", borderTopColor: "var(--accent-blue)" }} />
              <span className="preparing-title">
                Preparing program with AI agents ({progressPercent}% complete)
              </span>
            </div>
            <button
              id="cancel-banner-btn"
              type="button"
              className="btn-cancel-inline"
              onClick={cancelRun}
              disabled={isCancelling}
              title="Cancel preparing the program"
            >
              {isCancelling ? "Cancelling…" : "⏹ Cancel Run"}
            </button>
          </div>
          <div className="progress-bar-wrapper" style={{ margin: "0 2rem 1rem" }}>
            <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
        </>
      )}

      {/* Main Grid */}
      <div className="main-grid">
        {/* Spec Input — Prompt box always present on the home page */}
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isRunning && (
                  <button
                    id="cancel-pipeline-btn"
                    type="button"
                    className="btn-danger"
                    onClick={cancelRun}
                    disabled={isCancelling}
                    title="Cancel preparing the program"
                  >
                    {isCancelling ? (
                      <>
                        <span className="spinner" style={{ borderTopColor: "var(--accent-red)", width: "14px", height: "14px" }} />
                        Cancelling…
                      </>
                    ) : (
                      <>⏹ Cancel Pipeline</>
                    )}
                  </button>
                )}
                <button
                  id="run-pipeline-btn"
                  className="btn-primary"
                  onClick={startRun}
                  disabled={isRunning || spec.trim().length < 10}
                >
                  {isRunning ? (
                    <>
                      <span className="spinner" />
                      Preparing Program...
                    </>
                  ) : (
                    <>⚡ Run Pipeline</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Overview Card — Shown on Home Page before clicking Run Pipeline */}
        {!isProcessVisible && (
          <div className="workflow-preview">
            <div className="workflow-preview-header">
              <div className="workflow-preview-title">
                <span>🤖</span>
                <span>Autonomous 5-Agent Execution Workflow</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--accent-blue)" }}>
                Click &quot;⚡ Run Pipeline&quot; above to start execution
              </span>
            </div>
            <div className="workflow-steps-row">
              <div className="workflow-step-card">
                <span className="workflow-step-badge">Stage 1</span>
                <span className="workflow-step-name">🎯 Product Manager</span>
                <span className="workflow-step-desc">
                  Transforms your prompt into structured functional requirements, user stories, and specs.
                </span>
              </div>
              <div className="workflow-step-card">
                <span className="workflow-step-badge">Stage 2</span>
                <span className="workflow-step-name">🏗️ System Architect</span>
                <span className="workflow-step-desc">
                  Designs modular architecture, endpoints, database schemas, and dependency file plan.
                </span>
              </div>
              <div className="workflow-step-card">
                <span className="workflow-step-badge">Stage 3</span>
                <span className="workflow-step-name">💻 Senior Developer</span>
                <span className="workflow-step-desc">
                  Generates clean, production-ready code with parallel async batching for speed.
                </span>
              </div>
              <div className="workflow-step-card">
                <span className="workflow-step-badge">Stage 4</span>
                <span className="workflow-step-name">🧪 QA Engineer</span>
                <span className="workflow-step-desc">
                  Writes full pytest test suites and runs them live inside the isolated sandbox.
                </span>
              </div>
              <div className="workflow-step-card">
                <span className="workflow-step-badge">Stage 5</span>
                <span className="workflow-step-name">🔍 Code Reviewer</span>
                <span className="workflow-step-desc">
                  Performs staff-level code review for quality, security vulnerabilities, and score.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PROCESS AREA — ONLY VISIBLE WHEN USER CLICKS RUN PIPELINE */}
        {isProcessVisible && (
          <div className="process-section" ref={processSectionRef}>
            {/* Process Status Header */}
            <div className="process-status-header">
              <div className="process-status-title">
                <span>⚡ Active Pipeline Process</span>
                {runId && (
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", opacity: 0.8 }}>
                    ID: {runId.slice(0, 8)}
                  </span>
                )}
              </div>
              {!isRunning && (
                <button type="button" className="btn-reset-view" onClick={resetToHome}>
                  🔄 Reset / New Specification
                </button>
              )}
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
                <span
                  className={`status-dot ${
                    isRunning ? "streaming" : runStatus === "completed" ? "done" : runStatus === "failed" ? "error" : ""
                  }`}
                >
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
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: reviewResult.status === "PASS" ? "var(--accent-green)" : "var(--accent-red)",
                    }}
                  >
                    {reviewResult.status === "PASS" ? "✅ PASSED" : "❌ FAILED"}
                  </span>
                </div>
                <ReviewPanel review={reviewResult} />
              </div>
            )}
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
