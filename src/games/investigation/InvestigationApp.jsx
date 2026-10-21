import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";
import ConstellationCanvas from "./components/ConstellationCanvas.jsx";
import InvestigationGuidelinesModal from "./components/InvestigationGuidelinesModal.jsx";
import CaseBoard from "./CaseBoard.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function roleHeaders(teamId, role) {
  let participantRole = role;
  if (!participantRole) {
    try {
      participantRole = sessionStorage.getItem(`investigation_role_${teamId}`);
    } catch {}
  }
  return participantRole
    ? {
        "X-Investigation-Role": participantRole,
        "x-acting-role": participantRole,
      }
    : {};
}

function readSessionValue(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSessionValue(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {}
}

export default function InvestigationApp({
  teamId = "CC-001",
  onBack,
  onLogout,
}) {
  const [role, setRole] = useState(
    () => readSessionValue(`investigation_role_${teamId}`) || null,
  );
  const [isSplitMode, setIsSplitMode] = useState(
    () => readSessionValue(`investigation_split_${teamId}`) === "true",
  );
  const [mobileTab, setMobileTab] = useState("detective");
  const [caseState, setCaseState] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [pausedAt, setPausedAt] = useState(null);
  const [remainingTime, setRemainingTime] = useState("--:--");
  const [serverOffset, setServerOffset] = useState(0);
  const [roundStatus, setRoundStatus] = useState("running");
  const [analystInvite, setAnalystInvite] = useState(() =>
    readSessionValue(`analyst_invite_${teamId}`),
  );
  const [inviteExpiresAt, setInviteExpiresAt] = useState(() =>
    readSessionValue(`analyst_invite_expires_${teamId}`),
  );
  const [inviteInput, setInviteInput] = useState("");
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const serverOffsetRef = useRef(0);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/investigation/state`, {
        credentials: "include",
        headers: roleHeaders(teamId, role),
      });
      const data = await response.json();
      if (response.status === 401) {
        setRole(null);
        setCaseState(null);
        writeSessionValue(`investigation_role_${teamId}`, "");
        setError("");
        return null;
      }
      if (!response.ok) {
        throw new Error(
          data.error || "We could not load your case status. Please try again.",
        );
      }
      setCaseState(data.state);
      setRole(data.state?.role || null);
      writeSessionValue(`investigation_role_${teamId}`, data.state?.role || "");
      if (data.state?.roles?.analyst) {
        setAnalystInvite("");
        setInviteExpiresAt("");
        writeSessionValue(`analyst_invite_${teamId}`, "");
        writeSessionValue(`analyst_invite_expires_${teamId}`, "");
      }
      if (data.deadline) {
        const parsedDeadline = Date.parse(data.deadline);
        if (Number.isFinite(parsedDeadline)) setDeadline(parsedDeadline);
      }
      const parsedPausedAt = Date.parse(data.pausedAt);
      setPausedAt(Number.isFinite(parsedPausedAt) ? parsedPausedAt : null);
      const parsedServerNow = Date.parse(data.serverNow);
      if (Number.isFinite(parsedServerNow)) {
        serverOffsetRef.current = parsedServerNow - Date.now();
        setServerOffset(serverOffsetRef.current);
      }
      if (data.roundStatus) setRoundStatus(data.roundStatus);
      setError("");
      return data;
    } catch (requestError) {
      setError(
        requestError.message ||
          "We could not reach the game server. Check your connection and try again.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [role, teamId]);

  useEffect(() => {
    void fetchState();
    if (!role) return undefined;
    const interval = setInterval(() => void fetchState(), 2500);
    return () => clearInterval(interval);
  }, [fetchState, role]);

  useEffect(() => {
    if (!deadline) {
      setRemainingTime("--:--");
      return undefined;
    }
    const tick = () => {
      const serverNow = Date.now() + serverOffsetRef.current;
      const effectiveDeadline =
        roundStatus === "paused" && pausedAt
          ? deadline + Math.max(0, serverNow - pausedAt)
          : deadline;
      const seconds = Math.max(
        0,
        Math.floor((effectiveDeadline - serverNow) / 1000),
      );
      setRemainingTime(
        `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, pausedAt, roundStatus, serverOffset]);

  const handleJoinSameScreen = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/api/investigation/join/same-screen`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize split-screen mode.");
      }
      setIsSplitMode(true);
      writeSessionValue(`investigation_split_${teamId}`, "true");
      setRole("detective");
      writeSessionValue(`investigation_role_${teamId}`, "detective");
      setCaseState(data.detectiveState?.state || data.detectiveState || data.state);
      setNotice("Split-screen mode active. Both stations are accessible simultaneously.");
      await fetchState();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExitSplitMode = () => {
    setIsSplitMode(false);
    writeSessionValue(`investigation_split_${teamId}`, "");
  };

  const claimRole = async (path, body, assignedRole) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/api/investigation${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "We could not reserve this role. Try again.",
        );
      setIsSplitMode(false);
      writeSessionValue(`investigation_split_${teamId}`, "");
      setRole(assignedRole);
      setCaseState(data.state);
      writeSessionValue(`investigation_role_${teamId}`, assignedRole);
      if (data.analystInvite) {
        setAnalystInvite(data.analystInvite);
        setInviteExpiresAt(data.inviteExpiresAt || "");
        writeSessionValue(`analyst_invite_${teamId}`, data.analystInvite);
        writeSessionValue(
          `analyst_invite_expires_${teamId}`,
          data.inviteExpiresAt || "",
        );
      }
      setNotice(
        assignedRole === "detective"
          ? "You joined as Detective. Send the invitation code to your partner so they can join as Analyst."
          : "You joined as Analyst. You and your partner now share the same case file.",
      );
      await fetchState();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const renewInvite = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/investigation/invitation/renew`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...roleHeaders(teamId, "detective"),
          },
          body: JSON.stringify({}),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "We could not create a new partner code. Try again.",
        );
      setAnalystInvite(data.analystInvite);
      setInviteExpiresAt(data.inviteExpiresAt || "");
      setCaseState(data.state);
      writeSessionValue(`analyst_invite_${teamId}`, data.analystInvite);
      writeSessionValue(
        `analyst_invite_expires_${teamId}`,
        data.inviteExpiresAt || "",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(analystInvite);
      setNotice("Partner code copied.");
    } catch {
      setError(
        "We could not copy the code. Select it, then copy it to send to your partner.",
      );
    }
  };

  const invite = inviteInput.trim();
  const mutationsLocked =
    roundStatus !== "running" ||
    !deadline ||
    deadline <= Date.now() + serverOffset;
  const roleLabel =
    role === "detective"
      ? "Lead Detective"
      : role === "analyst"
        ? "Records Analyst"
        : "";

  return (
    <div
      className="investigation-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#050d14",
        color: "#e6f4f8",
      }}
    >
      <ConstellationCanvas />
      <header
        className="dual-topbar-controls"
        style={{
          padding: "12px 24px",
          background: "#0a1620",
          borderBottom: "1px solid rgba(0, 200, 233, 0.28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <small style={{ color: "#00c8e9" }}>CYPHERCLASH · ROUND 3</small>
          <h1 style={{ fontSize: 20, margin: "4px 0" }}>
            CASE HELIX — Who Moved the Files, and Why Was the Record Changed?
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isSplitMode ? (
            <span
              style={{
                background: "rgba(212, 240, 74, 0.2)",
                border: "1px solid #d4f04a",
                color: "#d4f04a",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              SPLIT-SCREEN ACTIVE (DUAL ROLES)
            </span>
          ) : role ? (
            <span
              style={{
                background:
                  role === "detective"
                    ? "rgba(0, 200, 233, 0.2)"
                    : "rgba(212, 240, 74, 0.2)",
                border: `1px solid ${role === "detective" ? "#00c8e9" : "#d4f04a"}`,
                color: role === "detective" ? "#00c8e9" : "#d4f04a",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              {roleLabel}
            </span>
          ) : null}

          {isSplitMode ? (
            <button
              className="product-btn product-btn--small"
              onClick={handleExitSplitMode}
              title="Switch to single role view"
            >
              ⌕ Single Role View
            </button>
          ) : (
            <button
              className="product-btn product-btn--small product-btn--primary"
              disabled={busy || roundStatus !== "running"}
              onClick={() => void handleJoinSameScreen()}
              title="Display Lead Detective and Records Analyst side-by-side on one screen"
            >
              ◫ Split-Screen View (Both Roles)
            </button>
          )}

          <strong
            aria-label="Round time remaining"
            style={{ color: "#d4f04a" }}
          >
            {remainingTime}
          </strong>
          {onBack && (
            <button className="product-btn product-btn--small" onClick={onBack}>
              Back
            </button>
          )}
          {onLogout && (
            <button
              className="product-btn product-btn--small"
              onClick={onLogout}
            >
              Log out
            </button>
          )}
        </div>
      </header>

      <main
        style={{
          width: isSplitMode ? "100%" : "min(1200px, calc(100% - 32px))",
          maxWidth: isSplitMode ? "100%" : "1200px",
          margin: isSplitMode ? "12px auto" : "24px auto",
          flex: 1,
          boxSizing: "border-box",
        }}
      >
        {error && (
          <div role="alert" style={{ marginBottom: 14, color: "#ffb3b8", padding: "0 16px" }}>
            {error}
          </div>
        )}
        {notice && (
          <div role="status" style={{ marginBottom: 14, color: "#d4f04a", padding: "0 16px" }}>
            {notice}
          </div>
        )}
        {loading ? (
          <section
            style={{ padding: 20, background: "#0a1620", borderRadius: 8, margin: "0 16px" }}
          >
            Loading your investigation…
          </section>
        ) : !role && !isSplitMode ? (
          <section
            style={{
              maxWidth: 680,
              margin: "40px auto",
              padding: 24,
              background: "#0a1620",
              border: "1px solid rgba(0,200,233,.22)",
              borderRadius: 10,
            }}
          >
            <h2>Start the investigation</h2>
            <p style={{ color: "#9fb8c2" }}>
              At 2:13 a.m., a restricted set of HELIX files was moved to a
              temporary holding area inside the complex. The receipt lists no
              approved project number for the move. Two minutes later, the
              summary no longer showed that temporary maintenance access had
              been used. You and a partner investigate from separate screens:
              the Detective speaks with people and checks physical records,
              while the Analyst checks computer activity and file records. Share
              what you find to work out what happened.
            </p>
            <div style={{ display: "grid", gap: 18 }}>
              {!caseState?.roles?.detective && (
                <button
                  className="product-btn product-btn--primary"
                  disabled={busy || roundStatus !== "running"}
                  onClick={() => void claimRole("/join", {}, "detective")}
                >
                  Join as Detective
                </button>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void claimRole("/join/analyst", { invite }, "analyst");
                }}
              >
                <label htmlFor="analyst-invite">Partner invitation code</label>
                <input
                  id="analyst-invite"
                  value={inviteInput}
                  onChange={(event) => setInviteInput(event.target.value)}
                  autoComplete="off"
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    margin: "8px 0 14px",
                    padding: 10,
                    color: "#e6f4f8",
                    background: "#050d14",
                    border: "1px solid rgba(255,255,255,.2)",
                    borderRadius: 5,
                  }}
                />
                <button
                  className="product-btn product-btn--primary"
                  disabled={busy || !invite}
                >
                  Join as Analyst
                </button>
              </form>

              {/* Split Screen Launch Option */}
              <div
                style={{
                  marginTop: "8px",
                  background: "rgba(0, 200, 233, 0.08)",
                  border: "1px solid #00c8e9",
                  borderRadius: "8px",
                  padding: "18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "left",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#00c8e9",
                      fontWeight: 800,
                    }}
                  >
                    STATIONS 01 & 02 // SAME SCREEN
                  </span>
                  <h3
                    style={{
                      fontSize: "17px",
                      margin: "4px 0",
                      color: "#fff",
                    }}
                  >
                    Launch Split-Screen Mode
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#9fb8c2",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    Play both Lead Detective and Records Analyst simultaneously
                    on this single screen.
                  </p>
                </div>
                <button
                  onClick={() => void handleJoinSameScreen()}
                  disabled={busy || roundStatus !== "running"}
                  className="product-btn product-btn--primary"
                  style={{
                    padding: "10px 20px",
                    fontSize: "13px",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  Launch Split-Screen Mode ↗
                </button>
              </div>
            </div>
          </section>
        ) : isSplitMode ? (
          <div
            className="investigation-split-wrapper"
            style={{ width: "100%", padding: "0 16px", boxSizing: "border-box" }}
          >
            <div className="investigation-split-controls">
              <button
                className={`investigation-split-tab-btn ${mobileTab === "detective" ? "is-active" : ""}`}
                onClick={() => setMobileTab("detective")}
              >
                Lead Detective
              </button>
              <button
                className={`investigation-split-tab-btn ${mobileTab === "analyst" ? "is-active" : ""}`}
                onClick={() => setMobileTab("analyst")}
              >
                Records Analyst
              </button>
            </div>

            <div className="investigation-split-container">
              {/* Left Column: Lead Detective */}
              <div
                className={`investigation-split-panel ${mobileTab === "detective" ? "" : "is-hidden-mobile"}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  height: "calc(100vh - 130px)",
                  overflow: "hidden",
                }}
              >
                <div
                  className="investigation-panel-header"
                  style={{ borderBottom: "2px solid #00c8e9" }}
                >
                  <h3
                    className="investigation-panel-role-title"
                    style={{ color: "#00c8e9" }}
                  >
                    STATION 01 // LEAD DETECTIVE
                  </h3>
                  <span style={{ fontSize: "11px", color: "#9fb8c2" }}>
                    Interviews & Physical Records
                  </span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                  <CaseBoard
                    teamId={caseState?.teamId || teamId}
                    role="detective"
                    caseState={caseState}
                    setCaseState={setCaseState}
                    locked={mutationsLocked}
                    isSplit={true}
                  />
                </div>
              </div>

              {/* Right Column: Records Analyst */}
              <div
                className={`investigation-split-panel ${mobileTab === "analyst" ? "" : "is-hidden-mobile"}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  height: "calc(100vh - 130px)",
                  overflow: "hidden",
                }}
              >
                <div
                  className="investigation-panel-header"
                  style={{ borderBottom: "2px solid #d4f04a" }}
                >
                  <h3
                    className="investigation-panel-role-title"
                    style={{ color: "#d4f04a" }}
                  >
                    STATION 02 // RECORDS ANALYST
                  </h3>
                  <span style={{ fontSize: "11px", color: "#9fb8c2" }}>
                    Computer Logs & Audit Traces
                  </span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                  <CaseBoard
                    teamId={caseState?.teamId || teamId}
                    role="analyst"
                    caseState={caseState}
                    setCaseState={setCaseState}
                    locked={mutationsLocked}
                    isSplit={true}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16,
                padding: 14,
                background: "#0a1620",
                border: "1px solid rgba(0,200,233,.2)",
                borderRadius: 8,
              }}
            >
              <span>
                {roleLabel} ·{" "}
                {caseState?.roles?.analyst
                  ? "Partner is here"
                  : "Waiting for your partner"}
              </span>
              {analystInvite &&
                role === "detective" &&
                !caseState?.roles?.analyst && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <code
                      style={{
                        padding: "6px 8px",
                        background: "#050d14",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {analystInvite}
                    </code>
                    <button
                      className="product-btn product-btn--small"
                      onClick={() => void copyInvite()}
                    >
                      Copy partner code
                    </button>
                    <button
                      className="product-btn product-btn--small"
                      disabled={busy}
                      onClick={() => void renewInvite()}
                    >
                      Create a new partner code
                    </button>
                    {inviteExpiresAt && (
                      <small>
                        Code expires at{" "}
                        {new Date(inviteExpiresAt).toLocaleTimeString()}
                      </small>
                    )}
                  </div>
                )}
            </div>
            <CaseBoard
              teamId={caseState?.teamId || teamId}
              role={role}
              caseState={caseState}
              setCaseState={setCaseState}
              locked={mutationsLocked}
            />
          </>
        )}
      </main>

      <InvestigationGuidelinesModal
        isOpen={showGuidelines}
        onClose={() => setShowGuidelines(false)}
      />
    </div>
  );
}
