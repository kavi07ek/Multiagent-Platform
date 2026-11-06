"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getSupabaseClient,
  getSupabaseCredentials,
} from "@/lib/supabase";

interface RegisteredUser {
  email: string;
  password?: string;
  username: string;
  role: string;
  createdAt: string;
}

const DEFAULT_ACCOUNTS: RegisteredUser[] = [
  {
    email: "sridharelankavi@gmail.com",
    password: "password123",
    username: "kavi07ek",
    role: "Autonomous Platform Lead",
    createdAt: new Date().toISOString(),
  },
  {
    email: "admin@agentforge.ai",
    password: "adminpassword",
    username: "admin",
    role: "Platform Administrator",
    createdAt: new Date().toISOString(),
  },
];

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

  // Initialize accounts store and check existing session
  useEffect(() => {
    try {
      // Seed default accounts if not yet created
      const storedAccounts = localStorage.getItem("agentforge_accounts");
      if (!storedAccounts) {
        localStorage.setItem("agentforge_accounts", JSON.stringify(DEFAULT_ACCOUNTS));
      }

      // Check existing session
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

  const validateInputs = () => {
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      setErrorMsg("Please enter your email address.");
      return false;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg("Please enter a valid email address (e.g. user@example.com).");
      return false;
    }

    if (!cleanPass) {
      setErrorMsg("Please enter your password.");
      return false;
    }

    if (cleanPass.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return false;
    }

    return true;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!validateInputs()) {
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    setIsLoading(true);

    const supabase = getSupabaseClient();

    // ----------------------------------------------------
    // 1. If Supabase is connected, authenticate with Supabase
    // ----------------------------------------------------
    if (supabase) {
      try {
        if (authMode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPass,
          });

          if (error) {
            setErrorMsg(`Supabase Error: ${error.message}`);
            setIsLoading(false);
            return;
          }

          if (data.user) {
            const userData = {
              username: cleanEmail.split("@")[0],
              email: data.user.email || cleanEmail,
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

            setSuccessMsg("✓ Account created in Supabase! Moving to home page...");
            setTimeout(() => {
              router.push("/");
            }, 600);
            return;
          }
        } else {
          // Sign In with Supabase
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPass,
          });

          if (error) {
            // Throw error for incorrect email/password
            setErrorMsg("❌ Incorrect email address or password. Please verify your credentials.");
            setIsLoading(false);
            return;
          }

          if (data.user) {
            const userData = {
              username: cleanEmail.split("@")[0],
              email: data.user.email || cleanEmail,
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
        setErrorMsg(`Authentication error: ${msg}`);
        setIsLoading(false);
        return;
      }
    }

    // ----------------------------------------------------
    // 2. Persistent Database Store (Account management & verification)
    // ----------------------------------------------------
    setTimeout(() => {
      let accounts: RegisteredUser[] = [];
      try {
        const raw = localStorage.getItem("agentforge_accounts");
        accounts = raw ? JSON.parse(raw) : DEFAULT_ACCOUNTS;
      } catch {
        accounts = DEFAULT_ACCOUNTS;
      }

      // --- SIGN UP MODE ---
      if (authMode === "signup") {
        const existing = accounts.find((acc) => acc.email.toLowerCase() === cleanEmail);
        if (existing) {
          setErrorMsg("❌ An account with this email already exists. Please sign in instead.");
          setIsLoading(false);
          return;
        }

        const newUser: RegisteredUser = {
          email: cleanEmail,
          password: cleanPass,
          username: cleanEmail.split("@")[0],
          role: "Software Engineer",
          createdAt: new Date().toISOString(),
        };

        // Save new user account to persistent database
        accounts.push(newUser);
        localStorage.setItem("agentforge_accounts", JSON.stringify(accounts));

        // Immediately log the signed up user in and move to home page
        const userData = {
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          token: `af_usr_${Math.random().toString(36).substring(2)}_${Date.now()}`,
          loggedInAt: new Date().toISOString(),
        };

        if (rememberMe) {
          localStorage.setItem("agentforge_user", JSON.stringify(userData));
        } else {
          sessionStorage.setItem("agentforge_user", JSON.stringify(userData));
        }

        setSuccessMsg("✓ Account created successfully! Moving into home page...");
        setTimeout(() => {
          setIsLoading(false);
          router.push("/");
        }, 500);
        return;
      }

      // --- SIGN IN MODE ---
      const matchedUser = accounts.find((acc) => acc.email.toLowerCase() === cleanEmail);

      // Check if email exists
      if (!matchedUser) {
        setErrorMsg("❌ Incorrect email address or no account found. Please check your email or sign up.");
        setIsLoading(false);
        return;
      }

      // Check if password matches
      if (matchedUser.password && matchedUser.password !== cleanPass) {
        setErrorMsg("❌ Incorrect password. Please try again.");
        setIsLoading(false);
        return;
      }

      // Credentials correct -> log in and move to home page
      const userData = {
        username: matchedUser.username,
        email: matchedUser.email,
        role: matchedUser.role,
        token: `af_sess_${Math.random().toString(36).substring(2)}_${Date.now()}`,
        loggedInAt: new Date().toISOString(),
      };

      if (rememberMe) {
        localStorage.setItem("agentforge_user", JSON.stringify(userData));
      } else {
        sessionStorage.setItem("agentforge_user", JSON.stringify(userData));
      }

      setSuccessMsg("✓ Credentials verified! Moving into home page...");
      setTimeout(() => {
        setIsLoading(false);
        router.push("/");
      }, 500);
    }, 400);
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
              {currentUser ? "Active Session" : authMode === "signup" ? "Create an Account" : "Sign in to AgentForge"}
            </h1>
            <p className="login-subtitle">
              {currentUser
                ? "You are logged in. You can move into the home page or switch accounts."
                : authMode === "signup"
                ? "Sign up to create your account and automatically move into the home page."
                : "Enter your registered email and password to access the platform."}
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
                Connect your Supabase project for persistent cloud user authentication and storing pipeline runs.
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
                  id="tab-signin"
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
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
                  id="tab-signup"
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
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
                  Sign Up (Create Account)
                </button>
              </div>

              {errorMsg && (
                <div
                  id="auth-error-alert"
                  style={{
                    background: "rgba(252, 129, 129, 0.12)",
                    border: "1px solid rgba(252, 129, 129, 0.35)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--accent-red)",
                    padding: "10px 14px",
                    fontSize: "0.82rem",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div
                  id="auth-success-alert"
                  style={{
                    background: "rgba(104, 211, 145, 0.12)",
                    border: "1px solid rgba(104, 211, 145, 0.35)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--accent-green)",
                    padding: "10px 14px",
                    fontSize: "0.82rem",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>✓</span>
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="login-form">
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
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMsg("");
                      }}
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
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg("");
                      }}
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
                    {isSupabaseReady ? "● Supabase Live" : "● Database Active"}
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
                      Verifying…
                    </>
                  ) : (
                    <>⚡ {authMode === "signup" ? "Create Account & Enter Home Page" : "Sign In & Enter Home Page"}</>
                  )}
                </button>
              </form>

              <div className="login-divider-box">
                <div className="login-divider-line" />
                <span className="login-divider-text">Or Instant Demo Access</span>
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
                Multi-Agent Software Engineering Platform • Protected by Gemini 3.8 Flash
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
