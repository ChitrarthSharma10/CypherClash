import { useCallback, useEffect, useMemo, useState } from "react";
import "./styles.css";
import ConstellationCanvas from "./components/ConstellationCanvas.jsx";
import InvestigationGuidelinesModal from "./components/InvestigationGuidelinesModal.jsx";
import ResultsModal from "./components/ResultsModal.jsx";
import CaseBoard from "./CaseBoard.jsx";
import { useRoundTimer } from "../../components/TimeLeftBanner.jsx";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:4000")
).replace(/\/+$/, "");

const NAV_TABS = [
  { id: "overview", label: "Case Overview", icon: "🔍", desc: "Briefing, incident timeline & live status" },
  { id: "records", label: "Documents & Records", icon: "📂", desc: "Signed work orders, Leena's note & archives" },
  { id: "forensics", label: "Computer Records & Puzzles", icon: "💻", desc: "Clock drift, audit summaries & puzzles" },
  { id: "interviews", label: "Witness Interviews", icon: "🎙️", desc: "Question personnel & uncover testimonies" },
  { id: "hypotheses", label: "Compare Explanations", icon: "⚖️", desc: "Assess alternative theories & cite records" },
  { id: "verdict", label: "Final Verdict", icon: "📝", desc: "Reconstruct file transfer & submit report" },
];

export default function InvestigationApp({
  teamId = "CC-001",
  round,
  serverNow,
  onBack,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [caseState, setCaseState] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Synced Round Timer
  const timer = useRoundTimer(round, serverNow);

  // Single-player unified request headers
  const reqHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    "X-Investigation-Role": "investigator",
    "x-acting-role": "investigator",
  }), []);

  // Fetch Public State
  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/investigation/state`, {
        credentials: "include",
        headers: reqHeaders,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not retrieve investigation state.");
      }
      setCaseState(data.state);
      setError("");
      return data.state;
    } catch (err) {
      setError(err.message || "Failed to sync investigation state.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [reqHeaders]);

  // Fetch Full Case Structure
  const fetchCase = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/investigation/case`, {
        credentials: "include",
        headers: reqHeaders,
      });
      const data = await response.json();
      if (response.ok && data.case) {
        setCaseData(data.case);
        if (data.state) setCaseState(data.state);
      }
    } catch {
      // Handled by state poll
    }
  }, [reqHeaders]);

  // Initial Join & Polling Loop
  useEffect(() => {
    let alive = true;
    const initialize = async () => {
      try {
        await fetch(`${API_URL}/api/investigation/join`, {
          method: "POST",
          credentials: "include",
          headers: reqHeaders,
          body: JSON.stringify({}),
        });
      } catch {
        // Handled via fetchState
      }
      if (alive) {
        await Promise.all([fetchState(), fetchCase()]);
      }
    };

    initialize();
    const interval = setInterval(() => {
      if (alive) fetchState();
    }, 2500);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [fetchCase, fetchState, reqHeaders]);

  // Stats calculation
  const wrongAttempts = caseState?.wrongAttempts || 0;
  const currentScore = caseState?.score != null
    ? caseState.score
    : Math.max(150, 500 - 15 * wrongAttempts);
  const discoveredEvidence = caseState?.discoveredEvidence || [];
  const solvedPuzzles = caseState?.solvedPuzzles || [];
  const isCompleted = Boolean(caseState?.completed || caseState?.gameState?.report?.score || caseState?.gameState?.report);
  const mutationsLocked = timer.isEnded || timer.isPaused;

  useEffect(() => {
    if (isCompleted) {
      setShowResults(true);
    }
  }, [isCompleted]);

  return (
    <div
      className="investigation-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#050d14",
        color: "#e6f4f8",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <ConstellationCanvas />

      {/* TOPBAR HUD */}
      <header
        style={{
          padding: "12px 24px",
          background: "#0a1620",
          borderBottom: "1px solid rgba(0, 200, 233, 0.28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          position: "sticky",
          top: 0,
          zIndex: 90,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <small style={{ color: "#00c8e9", fontWeight: 800, letterSpacing: 1 }}>
                CYBER CLASH · ROUND 3
              </small>
              <span
                style={{
                  background: "rgba(0, 200, 233, 0.15)",
                  border: "1px solid #00c8e9",
                  color: "#00c8e9",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                SINGLE-PLAYER WORKSPACE
              </span>
            </div>
            <h1 style={{ fontSize: 18, margin: "2px 0 0", color: "#fff" }}>
              CASE HELIX — Who Moved the Files, and Why Was the Record Changed?
            </h1>
          </div>
        </div>

        {/* HUD Counters & Synced Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Synced Round Timer */}
          <div
            style={{
              padding: "6px 14px",
              background: timer.isCritical ? "rgba(255, 77, 94, 0.2)" : "rgba(212, 240, 74, 0.1)",
              border: `1px solid ${timer.isCritical ? "#ff4d5e" : "#d4f04a"}`,
              borderRadius: 6,
              textAlign: "center",
            }}
            className={timer.isCritical ? "is-critical" : ""}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: timer.isCritical ? "#ff4d5e" : "#d4f04a" }}>
              {timer.isPaused ? "ROUND PAUSED" : timer.isEnded ? "ROUND ENDED" : "TIME REMAINING"}
            </div>
            <strong style={{ fontSize: 20, color: timer.isCritical ? "#ff4d5e" : "#d4f04a", letterSpacing: 1 }}>
              {timer.formattedTime}
            </strong>
          </div>

          {/* Current Score Badge */}
          <div
            style={{
              padding: "6px 14px",
              background: "rgba(0, 200, 233, 0.1)",
              border: "1px solid rgba(0, 200, 233, 0.35)",
              borderRadius: 6,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>SCORE</div>
            <strong style={{ fontSize: 20, color: "#ffffff" }}>
              {currentScore} <span style={{ fontSize: 12, color: "#00c8e9" }}>PTS</span>
            </strong>
          </div>

          {/* Penalties / Wrong Attempts */}
          <div
            style={{
              padding: "6px 14px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 6,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>WRONG SUBMISSIONS</div>
            <strong style={{ fontSize: 20, color: wrongAttempts > 0 ? "#ff4d5e" : "#22c55e" }}>
              {wrongAttempts} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>(-{wrongAttempts * 15} pts)</span>
            </strong>
          </div>

          {/* Records Discovered */}
          <div
            style={{
              padding: "6px 14px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 6,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>RECORDS FOUND</div>
            <strong style={{ fontSize: 20, color: "#00c8e9" }}>
              {discoveredEvidence.length} <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>/ 28</span>
            </strong>
          </div>

          {/* Action Buttons */}
          <button
            className="product-btn product-btn--small"
            onClick={() => setShowGuidelines(true)}
            title="Read investigation briefing & guidelines"
          >
            📖 Guidelines
          </button>

          {isCompleted && (
            <button
              className="product-btn product-btn--small product-btn--primary"
              onClick={() => setShowResults(true)}
            >
              🏆 View Scorecard
            </button>
          )}

          {onBack && (
            <button className="product-btn product-btn--small" onClick={onBack}>
              Back
            </button>
          )}
          {onLogout && (
            <button className="product-btn product-btn--small" onClick={onLogout}>
              Log out
            </button>
          )}
        </div>
      </header>

      {/* SUB-HEADER NAVIGATION TABS */}
      <nav
        aria-label="Investigation Navigation"
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 24px",
          background: "#08111a",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: isActive ? "rgba(0, 200, 233, 0.18)" : "transparent",
                color: isActive ? "#00c8e9" : "rgba(255, 255, 255, 0.75)",
                border: `1px solid ${isActive ? "#00c8e9" : "rgba(255, 255, 255, 0.12)"}`,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* FEEDBACK TOASTS */}
      {error && (
        <div
          role="alert"
          style={{
            margin: "12px 24px 0",
            padding: "10px 16px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: 6,
            color: "#ffb3b8",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          style={{
            margin: "12px 24px 0",
            padding: "10px 16px",
            background: "rgba(212, 240, 74, 0.15)",
            border: "1px solid rgba(212, 240, 74, 0.4)",
            borderRadius: 6,
            color: "#d4f04a",
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}

      {/* MAIN WORKSPACE DASHBOARD */}
      <main
        style={{
          flex: 1,
          padding: "20px 24px",
          display: "flex",
          gap: 20,
          boxSizing: "border-box",
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        {/* CENTER PANEL: SECTION CONTENT */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ padding: 32, background: "#0a1620", borderRadius: 10, textAlign: "center" }}>
              Loading Case HELIX dossier and live evidence…
            </div>
          ) : (
            <>
              {/* TAB 1: CASE OVERVIEW */}
              {activeTab === "overview" && (
                <div>
                  <div
                    style={{
                      background: "#070e17",
                      border: "1px solid rgba(0, 200, 233, 0.35)",
                      borderRadius: 10,
                      padding: 20,
                      marginBottom: 16,
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.7)",
                    }}
                  >
                    <small style={{ color: "#00c8e9", fontWeight: 700 }}>CASE BRIEFING</small>
                    <h2 style={{ margin: "6px 0 10px", fontSize: 20, color: "#fff" }}>
                      Incident at Veyra Research Complex · 02:13 AM
                    </h2>
                    <p style={{ color: "#9fb8c2", lineHeight: 1.6, margin: 0 }}>
                      At 2:13 a.m., a restricted set of HELIX files was moved to a temporary holding area inside the complex.
                      The receipt lists no approved project number for the move. Two minutes later, the summary no longer showed that temporary maintenance access had been used.
                      As Lead Investigator, explore document records, interview complex personnel, audit timestamps, evaluate competing theories, and assemble the final verdict report.
                    </p>
                  </div>

                  <CaseBoard
                    teamId={teamId}
                    role="investigator"
                    caseState={caseState}
                    setCaseState={setCaseState}
                    locked={mutationsLocked}
                    activeSection="overview"
                    onSectionChange={setActiveTab}
                  />
                </div>
              )}

              {/* TAB 2: RECORDS (Documents + Physical Records) */}
              {activeTab === "records" && (
                <CaseBoard
                  teamId={teamId}
                  role="investigator"
                  caseState={caseState}
                  setCaseState={setCaseState}
                  locked={mutationsLocked}
                  activeSection="records"
                  onSectionChange={setActiveTab}
                />
              )}

              {/* TAB 3: FORENSICS & COMPUTER LOGS */}
              {activeTab === "forensics" && (
                <CaseBoard
                  teamId={teamId}
                  role="investigator"
                  caseState={caseState}
                  setCaseState={setCaseState}
                  locked={mutationsLocked}
                  activeSection="forensics"
                  onSectionChange={setActiveTab}
                />
              )}

              {/* TAB 4: INTERVIEWS */}
              {activeTab === "interviews" && (
                <CaseBoard
                  teamId={teamId}
                  role="investigator"
                  caseState={caseState}
                  setCaseState={setCaseState}
                  locked={mutationsLocked}
                  activeSection="interviews"
                  onSectionChange={setActiveTab}
                />
              )}

              {/* TAB 5: COMPARE EXPLANATIONS */}
              {activeTab === "hypotheses" && (
                <CaseBoard
                  teamId={teamId}
                  role="investigator"
                  caseState={caseState}
                  setCaseState={setCaseState}
                  locked={mutationsLocked}
                  activeSection="hypotheses"
                  onSectionChange={setActiveTab}
                />
              )}

              {/* TAB 6: FINAL VERDICT */}
              {activeTab === "verdict" && (
                <CaseBoard
                  teamId={teamId}
                  role="investigator"
                  caseState={caseState}
                  setCaseState={setCaseState}
                  locked={mutationsLocked}
                  activeSection="verdict"
                  onSectionChange={setActiveTab}
                />
              )}
            </>
          )}
        </div>

        {/* PINNED RIGHT RAIL: LIVE CASE ACTIVITY & PROGRESS */}
        <aside
          style={{
            width: 320,
            background: "#0a1620",
            border: "1px solid rgba(0, 200, 233, 0.22)",
            borderRadius: 10,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            boxSizing: "border-box",
            position: "sticky",
            top: 80,
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#00c8e9", letterSpacing: 0.5 }}>
              ⚡ CASE ACTIVITY LOG
            </h3>
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {(caseState?.activity || []).length === 0 ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  No recent activity recorded yet.
                </div>
              ) : (
                caseState.activity.slice(-8).reverse().map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "8px 10px",
                      background: "#050d14",
                      borderLeft: "2px solid #00c8e9",
                      borderRadius: "0 4px 4px 0",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ color: "#e6f4f8", lineHeight: 1.3 }}>{item.message}</div>
                    <small style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
                      {item.at ? new Date(item.at).toLocaleTimeString() : "Just now"}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#d4f04a" }}>INVESTIGATION PROGRESS</h3>
            <div style={{ fontSize: 12, display: "grid", gap: 6, color: "#9fb8c2" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Records Unlocked:</span>
                <strong style={{ color: "#fff" }}>{discoveredEvidence.length} / 28</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Puzzles Solved:</span>
                <strong style={{ color: "#fff" }}>{solvedPuzzles.length} / 2</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Status:</span>
                <strong style={{ color: isCompleted ? "#22c55e" : "#00c8e9" }}>
                  {isCompleted ? "CASE RESOLVED ✓" : "IN PROGRESS"}
                </strong>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* MODALS */}
      <InvestigationGuidelinesModal
        isOpen={showGuidelines}
        onClose={() => setShowGuidelines(false)}
      />

      {showResults && (
        <ResultsModal
          result={{
            completed: Boolean(isCompleted),
            score: currentScore,
            wrongAttempts,
            teamId,
            suspect: caseData?.suspects?.find((s) => s.id === (caseState?.gameState?.report?.suspectId || "idris"))?.name || "Idris Khan",
          }}
          onClose={() => setShowResults(false)}
          onBack={onBack}
        />
      )}
    </div>
  );
}
