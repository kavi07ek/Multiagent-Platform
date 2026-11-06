"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProfileButtonProps {
  onApiKeyChange?: (key: string) => void;
}

interface UserData {
  username: string;
  email: string;
  role: string;
}

export default function ProfileButton({ onApiKeyChange }: ProfileButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved user and API key from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("agentforge_user") || sessionStorage.getItem("agentforge_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser({
          username: parsed.username || "kavi07ek",
          email: parsed.email || "sridharelankavi@gmail.com",
          role: parsed.role || "Autonomous Platform Lead",
        });
      } else {
        // Default demo session for immediate readiness
        setUser({
          username: "kavi07ek",
          email: "sridharelankavi@gmail.com",
          role: "Autonomous Platform Lead",
        });
      }
    } catch {
      setUser({
        username: "kavi07ek",
        email: "sridharelankavi@gmail.com",
        role: "Autonomous Platform Lead",
      });
    }

    const savedKey = localStorage.getItem("agentforge_gemini_key");
    if (savedKey) {
      setApiKey(savedKey);
      if (onApiKeyChange) onApiKeyChange(savedKey);
    }
  }, [onApiKeyChange]);

  // Handle outside click & escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSaveApiKey = () => {
    localStorage.setItem("agentforge_gemini_key", apiKey.trim());
    if (onApiKeyChange) onApiKeyChange(apiKey.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSignOut = () => {
    localStorage.removeItem("agentforge_user");
    sessionStorage.removeItem("agentforge_user");
    setUser(null);
    setIsOpen(false);
    router.push("/login");
  };

  const getInitials = (name: string) => {
    if (!name) return "AF";
    const parts = name.split(/[\s._-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const username = user?.username || "Guest";
  const email = user?.email || "guest@agentforge.ai";
  const role = user?.role || "Visitor";
  const initials = getInitials(username);

  return (
    <div className="profile-container" ref={dropdownRef}>
      <button
        id="profile-toggle-btn"
        className={`profile-button ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="User Profile and Settings"
        aria-expanded={isOpen}
      >
        <div className="profile-avatar">
          <span>{initials}</span>
          <span className="profile-status-indicator" title="Status: Online & Ready" />
        </div>
        <span className="profile-name">{username}</span>
        <span className="profile-chevron">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="profile-dropdown glass-card animate-dropdown">
          {/* User Details */}
          <div className="profile-header">
            <div className="profile-avatar-large">
              <span>{initials}</span>
            </div>
            <div className="profile-meta">
              <div className="profile-user-name">{username}</div>
              <div className="profile-user-role">{role}</div>
              <div className="profile-user-email">{email}</div>
            </div>
          </div>

          <div className="profile-divider" />

          {/* Quick Stats & System Status */}
          <div className="profile-section">
            <div className="profile-section-title">System & Database</div>
            <div className="profile-stat-item">
              <span className="profile-stat-label">Database</span>
              <span className="profile-stat-badge">Supabase DB</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-label">Model Pipeline</span>
              <span className="profile-stat-badge">Gemini 3.8 Flash</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-label">Orchestrator</span>
              <span className="profile-stat-badge">LangGraph (5 Agents)</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-label">Sandbox Engine</span>
              <span className="profile-stat-badge">Isolated Pytest venv</span>
            </div>
          </div>

          <div className="profile-divider" />

          {/* API Key Configuration */}
          <div className="profile-section">
            <div className="profile-section-title">Gemini API Key</div>
            <div className="profile-key-box">
              <div className="profile-input-wrapper">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste GEMINI_API_KEY (optional)"
                  className="profile-input"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="profile-key-toggle"
                  title={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? "👁️" : "🔒"}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="btn-primary"
                style={{ padding: "5px 12px", fontSize: "0.75rem", width: "100%" }}
              >
                {savedSuccess ? "✓ Saved to Session" : "Save API Key"}
              </button>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Leave empty to run in built-in intelligent demo simulation mode.
              </div>
            </div>
          </div>

          <div className="profile-divider" />

          {/* Links & Quick Actions */}
          <div className="profile-actions">
            <Link href="/login" className="profile-action-link" onClick={() => setIsOpen(false)}>
              <span>🔑</span>
              <span>Login / Switch Account</span>
              <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.7 }}>→</span>
            </Link>
            <a
              href="https://github.com/kavi07ek/Multiagent-Platform"
              target="_blank"
              rel="noopener noreferrer"
              className="profile-action-link"
            >
              <span>🐙</span>
              <span>GitHub Repository</span>
              <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.7 }}>↗</span>
            </a>
            <button
              type="button"
              className="profile-action-btn"
              onClick={() => {
                window.location.reload();
              }}
            >
              <span>🔄</span>
              <span>Reset Dashboard Session</span>
            </button>
            <button
              type="button"
              className="profile-action-btn"
              onClick={handleSignOut}
              style={{ color: "var(--accent-red)" }}
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
