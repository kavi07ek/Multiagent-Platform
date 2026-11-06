"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentUser, setCurrentUser] = useState<{ username: string; email: string } | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    try {
      const stored = localStorage.getItem("agentforge_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.username) {
          setCurrentUser(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!username.trim()) {
      setErrorMsg("Please enter your username or email address.");
      return;
    }
    if (!password.trim()) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const userData = {
        username: username.trim(),
        email: username.includes("@") ? username.trim() : `${username.trim().toLowerCase()}@agentforge.ai`,
        role: "Software Engineering Lead",
        token: `af_sess_${Math.random().toString(36).substring(2)}_${Date.now()}`,
        loggedInAt: new Date().toISOString(),
      };

      if (rememberMe) {
        localStorage.setItem("agentforge_user", JSON.stringify(userData));
      } else {
        sessionStorage.setItem("agentforge_user", JSON.stringify(userData));
      }

      setIsLoading(false);
      router.push("/");
    }, 600);
  };

  const handleDemoLogin = () => {
    setIsLoading(true);
    setErrorMsg("");

    setTimeout(() => {
      const demoUser = {
        username: "kavi07ek",
        email: "sridharelankavi@gmail.com",
        role: "Autonomous Platform Lead",
        token: `af_demo_${Date.now()}`,
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem("agentforge_user", JSON.stringify(demoUser));
      setIsLoading(false);
      router.push("/");
    }, 450);
  };

  const handleLogout = () => {
    localStorage.removeItem("agentforge_user");
    sessionStorage.removeItem("agentforge_user");
    setCurrentUser(null);
  };

  return (
    <div className="login-page-wrapper">
      {/* Top Bar */}
      <nav className="login-nav">
        <Link href="/" className="header-logo" style={{ textDecoration: "none" }}>
          <div className="logo-icon">⚡</div>
          <span className="logo-text">AgentForge</span>
        </Link>
        <Link href="/" className="login-header-btn">
          <span>← Back to Home</span>
        </Link>
      </nav>

      {/* Main Login Form Container */}
      <main className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-badge">
              <span>🔒 Authentication</span>
            </div>
            <h1 className="login-title">
              {currentUser ? "Active Session" : "Welcome to AgentForge"}
            </h1>
            <p className="login-subtitle">
              {currentUser
                ? "You are currently authenticated in the autonomous platform."
                : "Sign in to launch autonomous AI engineering pipelines and manage code workspaces."}
            </p>
          </div>

          {currentUser ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center" }}>
              <div
                style={{
                  background: "rgba(99, 179, 237, 0.08)",
                  border: "1px solid rgba(99, 179, 237, 0.25)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
                }}
              >
                <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>👤</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)" }}>
                  {currentUser.username}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {currentUser.email}
                </div>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={() => router.push("/")}
                style={{ padding: "12px", fontSize: "0.95rem" }}
              >
                ⚡ Continue to Dashboard
              </button>

              <button
                type="button"
                className="btn-danger"
                onClick={handleLogout}
                style={{ padding: "10px", fontSize: "0.85rem", width: "100%", justifyContent: "center" }}
              >
                🚪 Sign Out
              </button>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div
                  style={{
                    background: "rgba(252, 129, 129, 0.12)",
                    border: "1px solid rgba(252, 129, 129, 0.3)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--accent-red)",
                    padding: "10px 14px",
                    fontSize: "0.82rem",
                    marginBottom: "1rem",
                  }}
                >
                  ⚠️ {errorMsg}
                </div>
              )}

              <form onSubmit={handleLogin} className="login-form">
                <div className="login-field">
                  <label className="login-label" htmlFor="login-username">
                    Username or Email
                  </label>
                  <div className="login-input-group">
                    <span className="login-input-icon">👤</span>
                    <input
                      id="login-username"
                      type="text"
                      className="login-input"
                      placeholder="e.g. kavi07ek or your@email.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="login-field">
                  <div className="login-label">
                    <label htmlFor="login-password">Password</label>
                  </div>
                  <div className="login-input-group">
                    <span className="login-input-icon">🔑</span>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      className="login-input"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="login-input-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "👁️" : "🔒"}
                    </button>
                  </div>
                </div>

                <div className="login-options">
                  <label className="login-checkbox-label">
                    <input
                      type="checkbox"
                      className="login-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember this session</span>
                  </label>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    Demo Mode Enabled
                  </span>
                </div>

                <button
                  id="login-submit-btn"
                  type="submit"
                  className="btn-primary login-btn-submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner" style={{ width: "16px", height: "16px" }} />
                      Authenticating…
                    </>
                  ) : (
                    <>⚡ Sign In to Platform</>
                  )}
                </button>
              </form>

              <div className="login-divider-box">
                <div className="login-divider-line" />
                <span className="login-divider-text">Or Quick Access</span>
                <div className="login-divider-line" />
              </div>

              <button
                id="demo-login-btn"
                type="button"
                className="login-demo-btn"
                onClick={handleDemoLogin}
                disabled={isLoading}
              >
                <span>⚡ 1-Click Demo Sign In (kavi07ek)</span>
              </button>

              <p className="login-footer-text">
                Autonomous Software Engineering Platform • Protected by Gemini 3.8 Flash
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
