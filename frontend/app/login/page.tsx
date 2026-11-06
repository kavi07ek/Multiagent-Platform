"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getSupabaseClient,
  getSupabaseCredentials,
} from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [currentUser, setCurrentUser] = useState<{ username: string; email: string } | null>(null);

  // Supabase dynamic config drawer
  const [showDbConfig, setShowDbConfig] = useState(false);
  const [sbUrl, setSbUrl] = useState("");
  const [sbKey, setSbKey] = useState("");
  const [dbConfigSaved, setDbConfigSaved] = useState(false);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);

  useEffect(() => {
    // Check existing session
    try {
      const stored = localStorage.getItem("agentforge_user") || sessionStorage.getItem("agentforge_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email || parsed?.username) {
          setCurrentUser(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Check Supabase credentials
    const creds = getSupabaseCredentials();
    setIsSupabaseReady(creds.isConfigured);
    setSbUrl(creds.url);
    setSbKey(creds.key);
  }, []);

  const handleSaveDbConfig = () => {
    if (sbUrl.trim() && sbKey.trim()) {
      localStorage.setItem("agentforge_supabase_url", sbUrl.trim());
      localStorage.setItem("agentforge_supabase_key", sbKey.trim());
      setIsSupabaseReady(true);
      setDbConfigSaved(true);
      setTimeout(() => setDbConfigSaved(false), 3000);
    } else {
      localStorage.removeItem("agentforge_supabase_url");
      localStorage.removeItem("agentforge_supabase_key");
      const creds = getSupabaseCredentials();
      setIsSupabaseReady(creds.isConfigured);
    }
  };

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    const supabase = getSupabaseClient();

    // If Supabase client is configured, use live Supabase authentication
    if (supabase) {
      try {
        if (authMode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password.trim(),
          });

          if (error) {
            setErrorMsg(error.message);
            setIsLoading(false);
            return;
          }

          if (data.user) {
            const userData = {
              username: email.split("@")[0],
              email: data.user.email || email.trim(),
              role: "Developer",
              supabaseId: data.user.id,
              token: data.session?.access_token || `af_sb_${Date.now()}`,
              loggedInAt: new Date().toISOString(),
            };

            if (rememberMe) {
              localStorage.setItem("agentforge_user", JSON.stringify(userData));
            } else {
              sessionStorage.setItem("agentforge_user", JSON.stringify(userData));
            }

            setSuccessMsg("Account created in Supabase! Moving to home page...");
            setTimeout(() => {
              router.push("/");
            }, 800);
            return;
          }
        } else {
          // Sign in
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });

          if (error) {
            setErrorMsg(error.message);
            setIsLoading(false);
            return;
          }

          if (data.user) {
            const userData = {
              username: email.split("@")[0],
              email: data.user.email || email.trim(),
              role: "Software Engineering Lead",
              supabaseId: data.user.id,
              token: data.session?.access_token || `af_sb_${Date.now()}`,
              loggedInAt: new Date().toISOString(),
            };

            if (rememberMe) {
              localStorage.setItem("agentforge_user", JSON.stringify(userData));
            } else {
              sessionStorage.setItem("agentforge_user", JSON.stringify(userData));
            }

            setSuccessMsg("✓ Authenticated with Supabase! Redirecting to home page...");
            setTimeout(() => {
              router.push("/");
            }, 600);
            return;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(`Supabase auth error: ${msg}`);
        setIsLoading(false);
        return;
      }
    }

    // Fallback: If Supabase credentials are not yet set up, allow simulated auth with user's credentials
    setTimeout(() => {
      const userData = {
        username: email.includes("@") ? email.split("@")[0] : email.trim(),
        email: email.includes("@") ? email.trim() : `${email.trim().toLowerCase()}@agentforge.ai`,
        role: "Software Engineering Lead",
        token: `af_local_${Math.random().toString(36).substring(2)}_${Date.now()}`,
        loggedInAt: new Date().toISOString(),
      };

      if (rememberMe) {
        localStorage.setItem("agentforge_user", JSON.stringify(userData));
      } else {
        sessionStorage.setItem("agentforge_user", JSON.stringify(userData));
      }

      setSuccessMsg("✓ Logged in! Moving into home page...");
      setTimeout(() => {
        setIsLoading(false);
        router.push("/");
      }, 500);
    }, 600);
  };

  const handleDemoLogin = () => {
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    setTimeout(() => {
      const demoUser = {
        username: "kavi07ek",
        email: "sridharelankavi@gmail.com",
        role: "Autonomous Platform Lead",
        token: `af_demo_${Date.now()}`,
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem("agentforge_user", JSON.stringify(demoUser));
      setSuccessMsg("✓ Logged in as demo user! Moving to home page...");
      setTimeout(() => {
        setIsLoading(false);
        router.push("/");
      }, 400);
    }, 350);
  };

  const handleSignOut = () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="login-header-btn"
            onClick={() => setShowDbConfig(!showDbConfig)}
            title="Configure Supabase Database"
          >
            <span>🗄️ Supabase Config</span>
          </button>
          <Link href="/" className="login-header-btn">
            <span>← Home</span>
          </Link>
        </div>
      </nav>

      {/* Main Login Form Container */}
      <main className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-badge">
              <span>🗄️ Supabase Powered • AgentForge v1.0</span>
            </div>
            <h1 className="login-title">
              {currentUser ? "Active Session" : "Login to AgentForge"}
            </h1>
            <p className="login-subtitle">
              {currentUser
                ? "You are logged in. You can move into the home page or switch accounts."
                : "Authenticate first to access the autonomous AI multi-agent workspace."}
            </p>
          </div>

          {/* Collapsible Supabase Settings Drawer */}
          {showDbConfig && (
            <div
              style={{
                background: "rgba(13, 18, 32, 0.95)",
                border: "1px solid var(--border-accent)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                marginBottom: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--accent-blue)" }}>
                  🗄️ Supabase Database & Auth Settings
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: isSupabaseReady ? "var(--accent-green)" : "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  {isSupabaseReady ? "● Connected" : "○ Not configured"}
                </span>
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                Connect your Supabase project for persistent user authentication and storing pipeline runs.
              </p>
              <input
                type="text"
                placeholder="https://your-project.supabase.co"
                className="profile-input"
                value={sbUrl}
                onChange={(e) => setSbUrl(e.target.value)}
                style={{ fontSize: "0.75rem", padding: "8px 10px" }}
              />
              <input
                type="password"
                placeholder="your-supabase-anon-key"
                className="profile-input"
                value={sbKey}
                onChange={(e) => setSbKey(e.target.value)}
                style={{ fontSize: "0.75rem", padding: "8px 10px" }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveDbConfig}
                  style={{ flex: 1, padding: "7px 12px", fontSize: "0.75rem" }}
                >
                  {dbConfigSaved ? "✓ Saved Credentials" : "Save Supabase Config"}
                </button>
                <button
                  type="button"
                  className="btn-reset-view"
                  onClick={() => setShowDbConfig(false)}
                  style={{ padding: "7px 12px", fontSize: "0.75rem" }}
                >
                  Close
                </button>
              </div>
            </div>
          )}

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
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚡</div>
                <div style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--text-primary)" }}>
                  {currentUser.username}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {currentUser.email}
                </div>
                <div
                  style={{
                    display: "inline-block",
                    marginTop: "8px",
                    fontSize: "0.72rem",
                    color: "var(--accent-green)",
                    background: "rgba(104, 211, 145, 0.1)",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    border: "1px solid rgba(104, 211, 145, 0.2)",
                  }}
                >
                  ● Authenticated & Ready
                </div>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={() => router.push("/")}
                style={{ padding: "13px", fontSize: "1rem" }}
              >
                ⚡ Move into Home Page →
              </button>

              <button
                type="button"
                className="btn-danger"
                onClick={handleSignOut}
                style={{ padding: "10px", fontSize: "0.85rem", width: "100%", justifyContent: "center" }}
              >
                🚪 Sign Out
              </button>
            </div>
          ) : (
            <>
              {/* Tab Switcher: Sign In vs Sign Up */}
              <div
                style={{
                  display: "flex",
                  background: "rgba(255, 255, 255, 0.04)",
                  borderRadius: "var(--radius-md)",
                  padding: "4px",
                  marginBottom: "1.25rem",
                  border: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setAuthMode("signin")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    cursor: "pointer",
                    background: authMode === "signin" ? "rgba(99, 179, 237, 0.2)" : "transparent",
                    color: authMode === "signin" ? "var(--text-primary)" : "var(--text-muted)",
                    transition: "var(--transition)",
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    cursor: "pointer",
                    background: authMode === "signup" ? "rgba(99, 179, 237, 0.2)" : "transparent",
                    color: authMode === "signup" ? "var(--text-primary)" : "var(--text-muted)",
                    transition: "var(--transition)",
                  }}
                >
                  Create Account (Supabase)
                </button>
              </div>

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

              {successMsg && (
                <div
                  style={{
                    background: "rgba(104, 211, 145, 0.12)",
                    border: "1px solid rgba(104, 211, 145, 0.3)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--accent-green)",
                    padding: "10px 14px",
                    fontSize: "0.82rem",
                    marginBottom: "1rem",
                  }}
                >
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleSupabaseAuth} className="login-form">
                <div className="login-field">
                  <label className="login-label" htmlFor="login-email">
                    Email Address
                  </label>
                  <div className="login-input-group">
                    <span className="login-input-icon">✉️</span>
                    <input
                      id="login-email"
                      type="email"
                      className="login-input"
                      placeholder="e.g. user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="login-field">
                  <div className="login-label">
                    <label htmlFor="login-password">Password</label>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Min 6 characters</span>
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
                      required
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
                  <span style={{ fontSize: "0.74rem", color: isSupabaseReady ? "var(--accent-green)" : "var(--accent-blue)" }}>
                    {isSupabaseReady ? "● Supabase Live" : "● Direct Session"}
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
                    <>⚡ {authMode === "signin" ? "Sign In & Move to Home" : "Create Account & Move to Home"}</>
                  )}
                </button>
              </form>

              <div className="login-divider-box">
                <div className="login-divider-line" />
                <span className="login-divider-text">Or Instant Access</span>
                <div className="login-divider-line" />
              </div>

              <button
                id="demo-login-btn"
                type="button"
                className="login-demo-btn"
                onClick={handleDemoLogin}
                disabled={isLoading}
              >
                <span>⚡ 1-Click Demo Sign In (kavi07ek) → Home Page</span>
              </button>

              <p className="login-footer-text">
                Multi-Agent Software Engineering Platform • Supabase Database & Auth Integration
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
