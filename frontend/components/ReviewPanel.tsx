"use client";

interface ReviewPanelProps {
  review: Record<string, unknown>;
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function ReviewPanel({ review }: ReviewPanelProps) {
  const status = review.status as string;
  const score = review.overall_score as number;
  const summary = review.summary as string;
  const issues = (review.issues as Array<Record<string, string>>) || [];
  const positives = (review.positives as string[]) || [];

  const sortedIssues = [...issues].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <div className="review-body">
      {/* Score section */}
      <div className="review-score">
        <div className={`score-circle ${status === "PASS" ? "pass" : "fail"}`}>
          {score}
        </div>
        <div className="review-meta">
          <div className="review-status-text" style={{ color: status === "PASS" ? "var(--accent-green)" : "var(--accent-red)" }}>
            {status === "PASS" ? "✅ Review Passed" : "❌ Review Failed"}
          </div>
          <div className="review-summary">{summary}</div>
        </div>
      </div>

      {/* Positives */}
      {positives.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <div className="section-label">Strengths</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {positives.map((pos, i) => (
              <div key={i} style={{ fontSize: "0.82rem", color: "var(--accent-green)", display: "flex", gap: "8px" }}>
                <span>✨</span>
                <span>{pos}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {sortedIssues.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: "0.75rem" }}>
            Issues Found ({sortedIssues.length})
          </div>
          <div className="issues-list">
            {sortedIssues.map((issue, i) => (
              <div key={i} className="issue-item">
                <span className={`issue-severity ${issue.severity}`}>
                  {issue.severity}
                </span>
                <div className="issue-text">
                  <div className="issue-desc">
                    <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>
                      {issue.file}
                    </span>
                    {issue.description}
                  </div>
                  {issue.fix && (
                    <div className="issue-fix">→ {issue.fix}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedIssues.length === 0 && (
        <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--accent-green)", fontSize: "0.9rem" }}>
          🎉 No issues found! The code is production-ready.
        </div>
      )}
    </div>
  );
}
