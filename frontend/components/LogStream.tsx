"use client";

import { useEffect, useRef, useState } from "react";
import { type LogEntry } from "@/app/page";

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
};

interface LogStreamProps {
  logs: LogEntry[];
  isStreaming: boolean;
}

export default function LogStream({ logs, isStreaming }: LogStreamProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect manual scroll-up to pause auto-scroll
  const handleScroll = () => {
    const el = terminalRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setAutoScroll(atBottom);
  };

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  return (
    <div className="log-body">
      <div
        id="log-terminal"
        className="log-terminal"
        ref={terminalRef}
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="log-empty">
            <span>📡</span>
            <span>Agent logs will appear here in real-time…</span>
          </div>
        ) : (
          logs.map((entry, i) => (
            <div key={i} className="log-entry">
              <span className="log-time">{formatTime(entry.timestamp)}</span>
              <span className={`log-msg type-${entry.type}`}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", marginRight: "6px" }}>
                  [{entry.agent}]
                </span>
                {entry.message}
              </span>
            </div>
          ))
        )}

        {isStreaming && (
          <div className="log-entry">
            <span className="log-time">--:--:--</span>
            <span className="log-msg" style={{ color: "var(--text-muted)" }}>
              <span style={{ animation: "pulse-dot 1s infinite" }}>▋</span>
            </span>
          </div>
        )}
      </div>

      <div className="log-footer">
        <span className="log-count">{logs.length} events</span>
        {!autoScroll && logs.length > 0 && (
          <button
            className="btn-secondary"
            onClick={scrollToBottom}
            style={{ padding: "3px 10px", fontSize: "0.72rem" }}
          >
            ↓ Jump to bottom
          </button>
        )}
      </div>
    </div>
  );
}
