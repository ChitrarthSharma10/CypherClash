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
  return participantRole ? { "X-Investigation-Role": participantRole } : {};
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
          width: "min(1200px, calc(100% - 32px))",
          margin: "24px auto",
          flex: 1,
        }}
      >
        {error && (
          <div role="alert" style={{ marginBottom: 14, color: "#ffb3b8" }}>
            {error}
          </div>
        )}
        {notice && (
          <div role="status" style={{ marginBottom: 14, color: "#d4f04a" }}>
            {notice}
          </div>
        )}
        {loading ? (
          <section
            style={{ padding: 20, background: "#0a1620", borderRadius: 8 }}
          >
            Loading your investigation…
          </section>
        ) : !role ? (
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
            </div>
          </section>
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
