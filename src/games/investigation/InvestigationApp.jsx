import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import ConstellationCanvas from "./components/ConstellationCanvas.jsx";
import InvestigationGuidelinesModal from "./components/InvestigationGuidelinesModal.jsx";
import ResultsModal from "./components/ResultsModal.jsx";
import CaseBoard from "./CaseBoard.jsx";
import SharedBoard from "./components/SharedBoard.jsx";
import PlayerDossier from "./components/PlayerDossier.jsx";
import { useRoundTimer } from "../../components/TimeLeftBanner.jsx";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:4000")
).replace(/\/+$/, "");

const NAV_TABS = [
  { id: "overview", label: "Case Overview", icon: "🔍", desc: "Background & recent findings" },
  { id: "interviews", label: "Interviews", icon: "🎙️", desc: "Question witnesses & review statements" },
  { id: "records", label: "Records", icon: "📂", desc: "Physical records & document archives" },
  { id: "suspects", label: "Suspects", icon: "👤", desc: "Personnel dossiers & access logs" },
  { id: "forensics", label: "Forensics", icon: "💻", desc: "Computer logs, clock drift & token decrypt" },
  { id: "board", label: "Evidence Board", icon: "📌", desc: "Connect clues & analyze correlation" },
  { id: "clues", label: "Submit Clue", icon: "🔑", desc: "Submit stage findings & token decrypt" },
  { id: "verdict", label: "Final Verdict", icon: "⚖️", desc: "Reconstruct file transfer & submit report" },
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
  const [busy, setBusy] = useState(false);

  // Clue & Decrypt form states
  const [selectedClueKey, setSelectedClueKey] = useState("ev1");
  const [decryptToken, setDecryptToken] = useState("");
  const [boardConnections, setBoardConnections] = useState([]);
  const [boardFeedback, setBoardFeedback] = useState(null);

  // Synced Round Timer
  const timer = useRoundTimer(round, serverNow);

  // Unified Request Headers (role-less investigator)
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
        // Automatically ensure team case is joined/initialized
        await fetch(`${API_URL}/api/investigation/join`, {
          method: "POST",
          credentials: "include",
          headers: reqHeaders,
          body: JSON.stringify({}),
        });
      } catch {
        // Already initialized or will load via fetchState
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

  // Clue Submission
  const handleSubmitClue = async (e) => {
    e.preventDefault();
    if (!selectedClueKey || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`${API_URL}/api/investigation/evidence`, {
        method: "POST",
        credentials: "include",
        headers: reqHeaders,
        body: JSON.stringify({ key: selectedClueKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clue submission rejected.");
      setCaseState(data.state);
      setNotice(`Clue ${selectedClueKey.toUpperCase()} verified and added to shared case.`);
      await fetchCase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Decryption Token Submission
  const handleDecryptToken = async (e) => {
    e.preventDefault();
    if (!decryptToken.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`${API_URL}/api/investigation/decrypt`, {
        method: "POST",
        credentials: "include",
        headers: reqHeaders,
        body: JSON.stringify({ token: decryptToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decryption token invalid.");
      setCaseState(data.state);
      setNotice(data.message || "HELIX Token Decrypted successfully! Master evidence unlocked.");
      setDecryptToken("");
      await fetchCase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Board Connection handler
  const handleBoardConnect = (fromId, toId) => {
    setBoardConnections((prev) => [...prev, { from: fromId, to: toId }]);
    setBoardFeedback({
      success: true,
      message: `Linked record ${fromId} ↔ ${toId} on shared board.`,
    });
    setTimeout(() => setBoardFeedback(null), 3000);
  };

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
    if (isCompleted || timer.isEnded) {
      setShowResults(true);
    }
  }, [isCompleted, timer.isEnded]);

  // Evidence cards for SharedBoard
  const boardCards = useMemo(() => {
    if (!caseData?.evidence) return [];
    return caseData.evidence.slice(0, 12).map((ev) => ({
      id: ev.id,
      title: ev.title,
      badge: ev.branch,
      detail: ev.discovered ? ev.detail : "Discovered in field logs.",
      discovered: ev.discovered,
    }));
  }, [caseData?.evidence]);

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
                UNIFIED WORKSPACE
              </span>
            </div>
            <h1 style={{ fontSize: 18, margin: "2px 0 0", color: "#fff" }}>
              CASE HELIX — Who Moved the Files, and Why Was the Record Changed?
            </h1>
          </div>
        </div>

        {/* HUD Counters & Synced Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
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

      {/* SUB-HEADER NAVIGATION RAIL / TABS */}
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
                      Both teammates share this unified dashboard: explore physical evidence, interview personnel, audit computer timestamps, and assemble the final verdict report.
                    </p>
                  </div>

                  <CaseBoard
                    teamId={teamId}
                    role="investigator"
                    caseState={caseState}
                    setCaseState={setCaseState}
                    locked={mutationsLocked}
                    activeSection="overview"
                  />
                </div>
              )}

              {/* TAB 2: INTERVIEWS */}
              {activeTab === "interviews" && (
                <CaseBoard
                  teamId={teamId}
                  role="investigator"
                  caseState={caseState}
                  setCaseState={setCaseState}
                  locked={mutationsLocked}
                  activeSection="interviews"
                />
              )}

              {/* TAB 3: RECORDS (Physical + Documents) */}
              {activeTab === "records" && (
                <CaseBoard
                  teamId={teamId}
                  role="investigator"
                  caseState={caseState}
                  setCaseState={setCaseState}
                  locked={mutationsLocked}
                  activeSection="records"
                />
              )}

              {/* TAB 4: SUSPECTS & DOSSIERS */}
              {activeTab === "suspects" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <PlayerDossier
                    playerId="P1"
                    dossiers={{
                      P1: {
                        focusArea: "Physical Access & Email Records",
                        artifacts: [
                          {
                            id: "art-1",
                            name: "Badge H-204 Access Log",
                            summary: "Physical turnstile swipe at East Entrance 02:06 AM.",
                            snippet: "EVENT: BADGE_SCAN\nBADGE: H-204\nLOCATION: EAST_GATE_TURNSTILE\nTIMESTAMP: 02:06:14 UTC\nHOLDER_RECORD: Mara Chen\nSTATUS: ACCEPTED",
                          },
                          {
                            id: "art-2",
                            name: "Maintenance Request Ticket #4102",
                            summary: "Emergency ticket requesting bypass for HVAC filter in Server Hall B.",
                            snippet: "TICKET: #4102\nREQUESTOR: Gabriel Ramos\nTIME_WINDOW: 01:30 - 02:45 UTC\nSYSTEMS_TOUCHED: NET-12, RELAY_SRV\nSIGNED_BY: Idris Vance",
                          },
                        ],
                      },
                      P2: {
                        focusArea: "Computer SIEM & Network Traces",
                        artifacts: [
                          {
                            id: "art-3",
                            name: "Audit Service Relay Trace",
                            summary: "Message exchange between relay service and authorization ledger.",
                            snippet: "AUTH_DAEMON [02:09:41]: INCOMING_TOKEN_REQ\nSERVICE_ACCOUNT: srv_maintenance_relay\nCONTEXT: TEMPORARY_EXCEPTION_FLAG=TRUE\nORIGIN: NET-12 (SHARED TERMINAL)",
                          },
                          {
                            id: "art-4",
                            name: "File Export Manifest",
                            summary: "Archive payload transferred out to external media.",
                            snippet: "PAYLOAD_ID: HELIX-ENC-089\nSIZE: 4.82 GB\nTIMESTAMP_LOCAL: 02:15:02 (CLOCK FAST +2 MIN)\nREAL_TIMESTAMP: 02:13:02\nEXPORT_STATUS: COMPLETED",
                          },
                        ],
                      },
                    }}
                  />

                  <CaseBoard
                    teamId={teamId}
                    role="investigator"
                    caseState={caseState}
                    setCaseState={setCaseState}
                    locked={mutationsLocked}
                    activeSection="interviews"
                  />
                </div>
              )}

              {/* TAB 5: FORENSICS & COMPUTER LOGS */}
              {activeTab === "forensics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Token Decryption Utility */}
                  <div
                    style={{
                      background: "#0a1620",
                      border: "1px solid rgba(0, 200, 233, 0.35)",
                      borderRadius: 10,
                      padding: 20,
                    }}
                  >
                    <h3 style={{ margin: "0 0 8px", color: "#00c8e9" }}>
                      ⚡ Master Token Decryption Console
                    </h3>
                    <p style={{ fontSize: 13, color: "#9fb8c2", margin: "0 0 14px" }}>
                      Enter the recovered encryption token or passkey to unlock the encrypted HELIX transfer ledger.
                    </p>
                    <form onSubmit={handleDecryptToken} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input
                        type="text"
                        placeholder="Enter token string (e.g. HELIX-9921 or key)"
                        value={decryptToken}
                        onChange={(e) => setDecryptToken(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 240,
                          padding: "10px 14px",
                          background: "#050d14",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 6,
                          color: "#fff",
                        }}
                      />
                      <button
                        type="submit"
                        disabled={busy || !decryptToken.trim() || mutationsLocked}
                        className="product-btn product-btn--primary"
                      >
                        Decrypt Token
                      </button>
                    </form>
                    {caseState?.decrypted && (
                      <div style={{ marginTop: 10, color: "#d4f04a", fontSize: 13, fontWeight: 700 }}>
                        ✓ Master Token Successfully Decrypted!
                      </div>
                    )}
                  </div>

                  <CaseBoard
                    teamId={teamId}
                    role="investigator"
                    caseState={caseState}
                    setCaseState={setCaseState}
                    locked={mutationsLocked}
                    activeSection="forensics"
                  />
                </div>
              )}

              {/* TAB 6: EVIDENCE BOARD */}
              {activeTab === "board" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <SharedBoard
                    cards={boardCards}
                    connections={boardConnections}
                    onConnect={handleBoardConnect}
                    feedback={boardFeedback}
                    requiredHint="Link the physical badge entry to the authorization ledger to connect the sequence."
                  />
                  <CaseBoard
                    teamId={teamId}
                    role="investigator"
                    caseState={caseState}
                    setCaseState={setCaseState}
                    locked={mutationsLocked}
                    activeSection="timeline"
                  />
                </div>
              )}

              {/* TAB 7: SUBMIT CLUE */}
              {activeTab === "clues" && (
                <div
                  style={{
                    background: "#0a1620",
                    border: "1px solid rgba(0, 200, 233, 0.25)",
                    borderRadius: 10,
                    padding: 24,
                  }}
                >
                  <h2 style={{ margin: "0 0 10px", color: "#fff" }}>Submit Investigation Findings</h2>
                  <p style={{ color: "#9fb8c2", fontSize: 14, margin: "0 0 20px" }}>
                    Submit clues discovered in the laboratory logs to confirm milestones and earn team points.
                    Flawless completion awards up to 500 PTS. Each incorrect attempt incurs a 15 PTS penalty (150 PTS floor).
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
                    {["ev1", "ev2", "ev3"].map((key) => {
                      const alreadySubmitted = clues.some((c) => c.key === key);
                      return (
                        <div
                          key={key}
                          onClick={() => !alreadySubmitted && setSelectedClueKey(key)}
                          style={{
                            padding: 16,
                            borderRadius: 8,
                            background: selectedClueKey === key ? "rgba(0, 200, 233, 0.15)" : "#050d14",
                            border: `1px solid ${alreadySubmitted ? "#22c55e" : selectedClueKey === key ? "#00c8e9" : "rgba(255,255,255,0.15)"}`,
                            cursor: alreadySubmitted ? "default" : "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <strong style={{ color: "#00c8e9" }}>STAGE CLUE {key.toUpperCase()}</strong>
                            {alreadySubmitted && <span style={{ color: "#22c55e", fontWeight: 700 }}>✓ VERIFIED</span>}
                          </div>
                          <p style={{ fontSize: 12, color: "#b8cbd2", margin: 0 }}>
                            {key === "ev1" && "Incident Timestamp & Physical Entry"}
                            {key === "ev2" && "Server Relay & Exception Token"}
                            {key === "ev3" && "Audit Summary Discrepancy"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={handleSubmitClue} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <button
                      type="submit"
                      disabled={busy || mutationsLocked || clues.some((c) => c.key === selectedClueKey)}
                      className="product-btn product-btn--primary"
                      style={{ padding: "10px 24px" }}
                    >
                      Verify & Submit Clue {selectedClueKey.toUpperCase()}
                    </button>
                    {clues.some((c) => c.key === selectedClueKey) && (
                      <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>
                        This milestone is already verified!
                      </span>
                    )}
                  </form>
                </div>
              )}

              {/* TAB 8: FINAL VERDICT */}
              {activeTab === "verdict" && (
                <CaseBoard
                  teamId={teamId}
                  role="investigator"
                  caseState={caseState}
                  setCaseState={setCaseState}
                  locked={mutationsLocked}
                  activeSection="verdict"
                />
              )}
            </>
          )}
        </div>

        {/* PINNED RIGHT RAIL: LIVE ACTIVITY & SUMMARY */}
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
              ⚡ LIVE TEAM ACTIVITY
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
            <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#d4f04a" }}>CASE PROGRESS</h3>
            <div style={{ fontSize: 12, display: "grid", gap: 6, color: "#9fb8c2" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Records Unlocked:</span>
                <strong style={{ color: "#fff" }}>{discoveredEvidence.length} / 28</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Puzzles Solved:</span>
                <strong style={{ color: "#fff" }}>{solvedPuzzles.length}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Stage Clues:</span>
                <strong style={{ color: "#fff" }}>{clues.length} / 4</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Status:</span>
                <strong style={{ color: isCompleted ? "#22c55e" : "#00c8e9" }}>
                  {isCompleted ? "RESOLVED ✓" : "IN PROGRESS"}
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
            suspect: caseData?.suspects?.find((s) => s.id === caseState?.gameState?.report?.suspectId)?.name || "Idris Vance",
          }}
          onClose={() => setShowResults(false)}
          onBack={onBack}
        />
      )}
    </div>
  );
}
