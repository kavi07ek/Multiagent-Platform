"use client";

import { type PipelineState } from "@/app/page";

const STEPS = [
  {
    key: "pm",
    name: "Product Manager",
    desc: "Parses requirements → generates PRD & user stories",
    icon: "🎯",
  },
  {
    key: "architect",
    name: "System Architect",
    desc: "Designs system, DB schema, API, and file plan",
    icon: "🏗️",
  },
  {
    key: "developer",
    name: "Developer",
    desc: "Implements all source files from the architecture",
    icon: "💻",
  },
  {
    key: "qa",
    name: "QA Engineer",
    desc: "Writes tests and runs them in isolated sandbox",
    icon: "🧪",
  },
  {
    key: "reviewer",
    name: "Code Reviewer",
    desc: "Audits for security, performance, and quality",
    icon: "🔍",
  },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const STATUS_LABELS: Record<string, string> = {
  idle: "Waiting",
  active: "Running",
  done: "Complete",
  error: "Failed",
};

interface AgentPipelineProps {
  pipeline: PipelineState;
}

export default function AgentPipeline({ pipeline }: AgentPipelineProps) {
  return (
    <div className="pipeline-steps">
      {STEPS.map((step, idx) => {
        const status = pipeline[step.key as StepKey] || "idle";
        return (
          <div
            key={step.key}
            id={`pipeline-step-${step.key}`}
            className={`pipeline-step ${status}`}
          >
            <div className="step-icon">
              {status === "active" ? (
                <span className="spinner" style={{ borderTopColor: "var(--accent-blue)" }} />
              ) : status === "done" ? (
                "✓"
              ) : status === "error" ? (
                "✕"
              ) : (
                step.icon
              )}
            </div>
            <div className="step-content">
              <div className="step-name">
                {idx + 1}. {step.name}
              </div>
              <div className="step-desc">{step.desc}</div>
              <span className={`step-status ${status}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
