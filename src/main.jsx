import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  formatUpdatedAgo,
  useVisibleClock,
  useVisiblePolling,
} from "./useVisiblePolling.js";
import {
  applyCircuitInput,
  getCircuitPublicState,
  replayCircuit,
} from "../shared/circuit.js";
import { buildCircuitSchematic } from "./circuitSchematicLayout.js";
import {
  CodeInspectionIcon,
  DossierSearchIcon,
  GameControllerIcon,
  UnlockedTerminalIcon,
} from "./components/CardHeaderIcons.tsx";
import MazeApp from "./games/maze/MazeApp.jsx";
import RunnerApp from "./games/runner/RunnerApp.jsx";
import InvestigationApp from "./games/investigation/InvestigationApp.jsx";
import TimeLeftBanner from "./components/TimeLeftBanner.jsx";
import {
  TOTAL_ROUNDS,
  ROUND_NUMBERS,
  ROUND_METADATA,
} from "../shared/rounds.js";
import { getSocketConnection } from "./games/gameSocketClient.js";

const rounds = [
  {
    number: "01",
    title: "Mini Game Arena",
    subtitle: "The Warmup & Screening",
    time: "30 min",
    mode: "BROWSER MINI-GAMES",
    desc: "Build speed and digital intuition with quick decisions, patterns, and packet sorting.",
    focus: "Speed + instinct",
  },
  {
    number: "02",
    title: "Find the Hidden Clue",
    subtitle: "Web UI & Incident Trace",
    time: "45 min",
    mode: "DOM INVESTIGATION",
    desc: "Inspect source comments, examine hidden attributes, and decode credentials concealed across campus relay systems.",
    focus: "Web inspection",
  },
  {
    number: "03",
    title: "Two-Player Detective Mystery",
    subtitle: "Final Challenge",
    time: "45 min",
    mode: "TEAM INVESTIGATION",
    desc: "Team up with another player to question suspects, find clues, compare records, and work out who caused the incident before time runs out.",
    focus: "Teamwork + analysis",
  },
];

const API_URL = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:4000")
).replace(/\/+$/, "");

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || "Request failed");
  }
  return body;
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (path === "/") {
      const timer = setTimeout(() => {
        if (typeof window.__initCcNav === "function") {
          window.__initCcNav();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [path]);

  return (
    <div className="app-shell">
      {path === "/" && (
        <header className="cc-top">
          <nav className="cc-top__nav" aria-label="Event navigation">
            <span className="cc-top__pill" aria-hidden="true"></span>
            <a
              className="cc-top__link"
              href="#event-brief"
              data-accent="#ffc933"
            >
              Event brief
            </a>
            <a className="cc-top__link" href="#rounds" data-accent="#22c1f1">
              Rounds
            </a>
            <a
              className="cc-top__link"
              href="#scoreboard"
              data-accent="#ff4d5e"
            >
              Scoreboard
            </a>
          </nav>
          <a className="cc-top__logo" href="#event-brief">
            <img src="/club-logo.jpg" alt="OSCode club logo" />
          </a>
          <a
            className="cc-top__cta"
            href="/login"
            onClick={(event) => {
              event.preventDefault();
              navigate("/login");
            }}
          >
            Login <span aria-hidden="true">↗</span>
          </a>
        </header>
      )}
      <div className="page-shell">
        {path === "/" && <Landing />}
        {path === "/login" && (
          <Login onSuccess={() => navigate("/dashboard")} />
        )}
        {path === "/dashboard" && (
          <Dashboard onLogout={() => navigate("/login")} />
        )}
        {path === "/dashboard/maze" && (
          <DualControlMazeScreen
            onBack={() => navigate("/dashboard")}
            onLogout={() => navigate("/login")}
          />
        )}
        {path === "/dashboard/runner" && (
          <CyberRunnerScreen
            onBack={() => navigate("/dashboard")}
            onLogout={() => navigate("/login")}
          />
        )}
        {path === "/dashboard/circuit-sync" && (
          <CircuitSyncGame
            onBack={() => navigate("/dashboard")}
            onLogout={() => navigate("/login")}
          />
        )}
        {path === "/dashboard/investigation" && (
          <InvestigationGame
            onBack={() => navigate("/dashboard")}
            onLogout={() => navigate("/login")}
          />
        )}
        {path === "/dashboard/round3" && (
          <InvestigationScreen
            onBack={() => navigate("/dashboard")}
            onLogout={() => navigate("/login")}
          />
        )}
        {path.startsWith("/investigation/resources/") && (
          <InvestigationResourcePage
            path={path}
            onBack={() => navigate("/dashboard/investigation")}
          />
        )}
        {path === "/leaderboard" && (
          <LeaderboardScreen
            onBack={() => navigate("/dashboard")}
            onLogout={() => navigate("/login")}
          />
        )}
        {path === "/admin/login" && (
          <AdminLogin onSuccess={() => navigate("/admin")} />
        )}
        {path === "/admin" && (
          <AdminDashboard onLogout={() => navigate("/admin/login")} />
        )}
        {![
          "/",
          "/login",
          "/dashboard",
          "/dashboard/maze",
          "/dashboard/runner",
          "/dashboard/circuit-sync",
          "/dashboard/investigation",
          "/dashboard/round3",
          "/leaderboard",
          "/admin/login",
          "/admin",
        ].includes(path) &&
          !path.startsWith("/investigation/resources/") && <NotFound />}
      </div>
    </div>
  );
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function LandingScoreboard() {
  const { data: board, error, updatedAt } = useVisiblePolling(() => apiRequest('/api/leaderboard'));
  const now = useVisibleClock();

  const rows = board?.rows || [];
  const topThree = rows.slice(0, 3);
  const remainingRows = rows.slice(3, 10);

  // Podium slots: Rank 2 (Left), Rank 1 (Center), Rank 3 (Right)
  const first = topThree[0];
  const second = topThree[1];
  const third = topThree[2];

  return (
    <section className="cc-board" id="scoreboard">
      <p className="cc-board__eyebrow">
        Live Scoreboard
        {updatedAt && <span className="cc-board__sample" style={{ color: '#22c1f1', borderColor: 'rgba(34, 193, 241, 0.3)' }}>{formatUpdatedAgo(updatedAt, now)}</span>}
      </p>
      <h2 className="cc-board__title">Live tournament leaderboard. Scores update automatically.</h2>

      {error && !board && (
        <p className="cc-poll-offline" role="status" style={{ justifyContent: 'center', margin: '20px auto', maxWidth: '400px' }}>
          Unable to load live standings.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="cc-rank" role="table" aria-label="Live standings" style={{ margin: '36px auto 0' }}>
          <div className="cc-rank__row cc-rank__row--head" role="row">
            <span role="columnheader">#</span><span role="columnheader">Team</span>
            <span role="columnheader">R1</span><span role="columnheader">R2</span>
            <span role="columnheader">R3</span>
            <span role="columnheader">Total</span>
          </div>
          <div className="cc-rank__row" role="row">
            <span role="cell">—</span>
            <span role="cell" className="cc-rank__team">Waiting for tournament scores…</span>
            <span role="cell">—</span><span role="cell">—</span><span role="cell">—</span>
            <span role="cell" className="cc-rank__total">—</span>
          </div>
        </div>
      ) : (
        <>
          <div className="cc-podium is-in" aria-label="Top three teams">
            {/* Rank 2 */}
            <div className="cc-pod cc-pod--2">
              {second ? (
                <div className="cc-pod__who">
                  <span className="cc-pod__avatar" aria-hidden="true">{getInitials(second.name)}</span>
                  <span className="cc-pod__name" title={second.name}>{second.name}</span>
                  <span className="cc-pod__pts">{second.total} pts</span>
                </div>
              ) : (
                <div className="cc-pod__who" style={{ opacity: 0.4 }}>
                  <span className="cc-pod__avatar" aria-hidden="true">—</span>
                  <span className="cc-pod__name">TBD</span>
                  <span className="cc-pod__pts">— pts</span>
                </div>
              )}
              <div className="cc-pod__block"><span>2</span></div>
            </div>

            {/* Rank 1 */}
            <div className="cc-pod cc-pod--1">
              <svg className="cc-pod__trophy" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-1.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98 1.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
              {first ? (
                <div className="cc-pod__who">
                  <span className="cc-pod__avatar" aria-hidden="true">{getInitials(first.name)}</span>
                  <span className="cc-pod__name" title={first.name}>{first.name}</span>
                  <span className="cc-pod__pts">{first.total} pts</span>
                </div>
              ) : (
                <div className="cc-pod__who" style={{ opacity: 0.4 }}>
                  <span className="cc-pod__avatar" aria-hidden="true">—</span>
                  <span className="cc-pod__name">TBD</span>
                  <span className="cc-pod__pts">— pts</span>
                </div>
              )}
              <div className="cc-pod__block"><span>1</span></div>
            </div>

            {/* Rank 3 */}
            <div className="cc-pod cc-pod--3">
              {third ? (
                <div className="cc-pod__who">
                  <span className="cc-pod__avatar" aria-hidden="true">{getInitials(third.name)}</span>
                  <span className="cc-pod__name" title={third.name}>{third.name}</span>
                  <span className="cc-pod__pts">{third.total} pts</span>
                </div>
              ) : (
                <div className="cc-pod__who" style={{ opacity: 0.4 }}>
                  <span className="cc-pod__avatar" aria-hidden="true">—</span>
                  <span className="cc-pod__name">TBD</span>
                  <span className="cc-pod__pts">— pts</span>
                </div>
              )}
              <div className="cc-pod__block"><span>3</span></div>
            </div>
          </div>

          {remainingRows.length > 0 && (
            <div className="cc-rank" role="table" aria-label="Leaderboard from rank 4">
              <div className="cc-rank__row cc-rank__row--head" role="row">
                <span role="columnheader">#</span><span role="columnheader">Team</span>
                <span role="columnheader">R1</span><span role="columnheader">R2</span>
                <span role="columnheader">R3</span>
                <span role="columnheader">Total</span>
              </div>
              {remainingRows.map((row, index) => (
                <div className="cc-rank__row" role="row" key={`${row.name}-${index + 4}`}>
                  <span role="cell">{row.rank}</span>
                  <span role="cell" className="cc-rank__team">{row.name}</span>
                  <span role="cell">{row.r1 === null ? '–' : row.r1}</span>
                  <span role="cell">{row.r2 === null ? '–' : row.r2}</span>
                  <span role="cell">{row.r3 === null ? '–' : row.r3}</span>
                  <span role="cell" className="cc-rank__total">{row.total}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <a className="cc-btn cc-btn--ghost cc-board__cta" href="/login">Login <span aria-hidden="true">↗</span></a>
    </section>
  );
}

function Landing() {
  return (
    <main>
      <section className="cc-hero" id="event-brief">
        <p className="cc-hero__presenter">OSCode Presents</p>
        <h1 className="cc-hero__title">
          <span className="cc-hero__w1">Cyber </span>
          <span className="cc-hero__w2">Clash</span>
        </h1>
        <p className="cc-hero__tag">
          Because writing secure code was too much work.
        </p>
        <div className="cc-hero__actions">
          <a className="cc-btn cc-btn--solid" href="/login">
            Login <span aria-hidden="true">↗</span>
          </a>
          <a className="cc-btn cc-btn--ghost" href="#rounds">
            Explore the rounds <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>
      <section className="cc-rounds" id="rounds">
        <dl className="cc-facts">
          <div className="cc-fact">
            <dt>Format</dt>
            <dd>3-round tournament</dd>
          </div>
          <div className="cc-fact">
            <dt>Team format</dt>
            <dd>2 players · 1 shared screen</dd>
          </div>
          <div className="cc-fact">
            <dt>Entry level</dt>
            <dd>Zero prerequisites</dd>
          </div>
          <div className="cc-fact">
            <dt>Venue</dt>
            <dd>AIML Seminar Hall</dd>
          </div>
          <div className="cc-fact">
            <dt>Time</dt>
            <dd>2:00 PM – 4:00 PM</dd>
          </div>
        </dl>
        <div className="cc-fan">
          {rounds.map((round, index) => (
            <article
              className={`cc-card cc-card--${index + 1}`}
              tabIndex="0"
              key={round.number}
            >
              <div className="cc-card__top">
                <span className="cc-card__num">{round.number}</span>
                <span className="cc-card__icon">
                  {index === 0 && (
                    <GameControllerIcon size={24} title="Mini games" />
                  )}
                  {index === 1 && (
                    <CodeInspectionIcon size={24} title="Code inspection" />
                  )}
                  {index === 2 && (
                    <DossierSearchIcon size={24} title="Dossier search" />
                  )}
                </span>
              </div>
              <div className="cc-card__body">
                <p className="cc-card__eyebrow">
                  {round.mode} / {round.time}{" "}
                  {index === 2 && <span className="cc-card__tag">Finale</span>}
                </p>
                <h3 className="cc-card__name">{round.title}</h3>
                <div className="cc-card__more">
                  <div>
                    <p className="cc-card__desc">{round.desc}</p>
                    <p className="cc-card__skill">
                      <span>Skill focus</span>
                      {round.focus}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <LandingScoreboard />
      <footer>
        <span>CYBER CLASH / 2026</span>
        <span>Made for curious beginners.</span>
      </footer>
    </main>
  );
}

function AuthShell({ eyebrow, title, children }) {
  return (
    <main className="product-page cc-login-page">
      <a className="cc-auth-home" href="/">
        ← Back to home
      </a>
      <section className="product-card auth-card cc-auth-card">
        <p className="product-eyebrow">{eyebrow}</p>
        <h1 className="cc-auth-title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="product-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FormMessage({ error, success }) {
  if (!error && !success) return null;
  return (
    <p
      className={`product-message ${error ? "is-error" : "is-success"}`}
      role="status"
    >
      {error || success}
    </p>
  );
}

function AuthFeedback({ error, success }) {
  if (!error && !success) return null;
  return (
    <p
      className={`cc-auth-message ${error ? "is-error" : "is-success"}`}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
    >
      {error
        ? "Unable to sign in. Check your credentials and try again."
        : success}
    </p>
  );
}

function Login({ onSuccess }) {
  const [form, setForm] = useState({ teamId: "", password: "" });
  const [state, setState] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setState({ loading: true, error: "", success: "" });
    try {
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setState({
        loading: false,
        error: "",
        success: "Login successful. Opening your dashboard.",
      });
      onSuccess();
    } catch (error) {
      setState({ loading: false, error: error.message, success: "" });
    }
  };

  return (
    <AuthShell eyebrow="PARTICIPANT PORTAL / SECURE ACCESS" title="Team login">
      <p className="product-intro">
        Use the credentials issued to your team. Your session stays active when
        you refresh.
      </p>
      <form
        className="product-form cc-login-form"
        onSubmit={submit}
        aria-busy={state.loading}
      >
        <Field label="TEAM ID">
          <input
            required
            maxLength={20}
            value={form.teamId}
            onChange={(event) =>
              setForm({ ...form, teamId: event.target.value.toUpperCase() })
            }
            placeholder="CC-001"
            autoComplete="username"
          />
        </Field>
        <div className="cc-password-field">
          <label className="cc-auth-label" htmlFor="team-password">
            PASSWORD
          </label>
          <div className="cc-password-input">
            <input
              id="team-password"
              required
              maxLength={128}
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              autoComplete="current-password"
            />
            <button
              type="button"
              className="cc-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <AuthFeedback error={state.error} success={state.success} />
        <button
          className="product-btn product-btn--primary"
          disabled={state.loading}
        >
          {state.loading ? "Signing in…" : "Enter dashboard"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
    </AuthShell>
  );
}

function AdminLogin({ onSuccess }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [state, setState] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setState({ loading: true, error: "", success: "" });
    try {
      await apiRequest("/api/auth/admin/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSuccess();
    } catch (error) {
      setState({ loading: false, error: error.message, success: "" });
    }
  };

  return (
    <AuthShell eyebrow="CONTROL CENTER / ADMIN ACCESS" title="Admin login">
      <p className="product-intro">
        Administrative access is restricted to event staff.
      </p>
      <form
        className="product-form cc-login-form"
        onSubmit={submit}
        aria-busy={state.loading}
      >
        <Field label="USERNAME">
          <input
            required
            value={form.username}
            onChange={(event) =>
              setForm({ ...form, username: event.target.value })
            }
            autoComplete="username"
          />
        </Field>
        <div className="cc-password-field">
          <label className="cc-auth-label" htmlFor="admin-password">
            PASSWORD
          </label>
          <div className="cc-password-input">
            <input
              id="admin-password"
              required
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              autoComplete="current-password"
            />
            <button
              type="button"
              className="cc-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <AuthFeedback error={state.error} success={state.success} />
        <button
          className="product-btn product-btn--primary"
          disabled={state.loading}
        >
          {state.loading ? "Signing in…" : "Open control center"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
    </AuthShell>
  );
}

function Status({ online, label }) {
  return (
    <span
      className={`product-status ${online ? "is-online" : ""}`}
      aria-live="polite"
    >
      <i />
      {label || (online ? "Online" : "Offline")}
    </span>
  );
}

function Dashboard({ onLogout }) {
  const { data, error, updatedAt, refresh } = useVisiblePolling(async () => {
    const [team, score] = await Promise.all([
      apiRequest("/api/team/me"),
      apiRequest("/api/team/score"),
    ]);
    return { team, score };
  });
  const clockNow = useVisibleClock();

  useEffect(() => {
    if (error === "Authentication required") onLogout();
  }, [error, onLogout]);

  useEffect(() => {
    const socket = getSocketConnection();
    socket.on("round:update", () => {
      if (typeof refresh === "function") refresh();
    });
    return () => {
      socket.disconnect();
    };
  }, [refresh]);

  const retry = () => window.location.reload();

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        headers: { "X-Session-Role": "team" },
        body: JSON.stringify({ role: "team" }),
      });
    } finally {
      onLogout();
    }
  };

  if (!data && !error) return <LoadingState label="Loading team dashboard…" />;
  if (!data) return <ErrorState message={error} onRetry={retry} />;
  const round = data.team.currentRound;
  const roundDeadline = round?.deadline
    ? new Date(round.deadline).getTime()
    : null;
  const pausedAt = round?.pausedAt ? new Date(round.pausedAt).getTime() : null;
  const remainingMs =
    !round || round.status === "not_started" || roundDeadline === null
      ? null
      : round.status === "ended"
        ? 0
        : Math.max(
            0,
            roundDeadline -
              (round.status === "paused" && pausedAt !== null
                ? pausedAt
                : clockNow),
          );
  const scores = data.score?.rounds || {};
  const progression = data.team.progression || {
    effectiveEligibleRound: 1,
    waivedRounds: [],
    rounds: {},
  };
  const r1Waived =
    progression.waivedRounds?.includes(1) ||
    progression.rounds?.[1]?.status === "waived";
  const r2Waived =
    progression.waivedRounds?.includes(2) ||
    progression.rounds?.[2]?.status === "waived";
  const r3Waived =
    progression.waivedRounds?.includes(3) ||
    progression.rounds?.[3]?.status === "waived";
  const r2PrereqMet = (progression.effectiveEligibleRound || 1) >= 2;
  const r3PrereqMet = (progression.effectiveEligibleRound || 1) >= 3;
  const roundOneRunning = round?.round === 1 && round.status === "running";
  const roundTwoRunning = round?.round === 2 && round.status === "running";
  const roundThreeRunning = round?.round === 3 && round.status === "running";
  const roundThreePaused = round?.round === 3 && round.status === "paused";
  const games = data.score?.games || {};
  const circuitCompleted = Boolean(games["circuit"] || games["1_circuit"]);
  const mazeCompleted = Boolean(games["maze"] || games["1_maze"]);
  const runnerCompleted = Boolean(games["runner"] || games["1_runner"]);
  const investigationCompleted =
    Object.hasOwn(scores, "2") ||
    Boolean(games["investigation"] || games["2_investigation"]);
  const roundThreeCompleted =
    Object.hasOwn(scores, "3") || Boolean(games["3_investigation"]);
  return (
    <main className="product-page dashboard-page cc-dashboard">
      <header className="cc-dashboard-header">
        <div>
          <p className="product-eyebrow">PARTICIPANT PORTAL / TEAM DASHBOARD</p>
          <h1>{data.team.name}</h1>
          <div className="cc-dashboard-identity">
            <span>
              Team ID <strong>{data.team.teamId}</strong>
            </span>
            <span>
              Bias points <strong>{data.team.biasPoints}</strong>
            </span>
            <span>
              Eligibility{" "}
              <strong>Round {progression.effectiveEligibleRound || 1}</strong>
            </span>
            <Status online={data.team.online} />
          </div>
        </div>
        <button className="product-btn product-btn--light" onClick={logout}>
          Log out
        </button>
      </header>
      <div className="cc-poll-status" aria-live="polite">
        <span>{formatUpdatedAgo(updatedAt, clockNow)}</span>
        {error && (
          <strong role="status">
            Offline — unable to refresh live data. {error}
          </strong>
        )}
      </div>
      <section className="cc-dashboard-overview" aria-label="Team overview">
        <article className="cc-overview-card cc-round-overview">
          <p className="product-eyebrow">ROUND STATUS</p>
          <h2>
            {round?.round
              ? `Round ${String(round.round).padStart(2, "0")}`
              : "No round started"}
          </h2>
          <div className="cc-round-overview__status">
            <span
              className={`cc-round-status cc-round-status--${round?.status || "not_started"}`}
              aria-live="polite"
            >
              {round?.status === "paused"
                ? "PAUSED"
                : (round?.status || "not started").replaceAll("_", " ")}
            </span>
          </div>
          <strong className="cc-round-overview__timer">
            {formatDuration(remainingMs)}
          </strong>
          <p>
            {round?.status === "running" && round.round === 1
              ? "Round 1 is live. Choose an available game below."
              : round?.status === "running" && round.round === 3
                ? "Round 3 is live. Collaborative incident investigation is ready."
                : round?.status === "running"
                  ? "Play together across your team devices."
                  : round?.status === "paused"
                    ? "Play is paused. Your remaining time is frozen."
                    : round?.status === "ended"
                      ? "This round has ended."
                      : "The next round has not started yet."}
          </p>
        </article>
        <article className="cc-overview-card cc-score-card">
          <p className="product-eyebrow">YOUR SCORE</p>
          <h2>Round breakdown</h2>
          <strong className="cc-score-card__total">
            {data.score?.total ?? 0}
            <span> total points</span>
          </strong>
          <div className="cc-score-card__rounds">
            {ROUND_NUMBERS.map((roundNumber) => {
              const roundKey = String(roundNumber);
              const hasScore = Object.hasOwn(scores, roundKey);
              const isWaived =
                progression.waivedRounds?.includes(roundNumber) ||
                progression.rounds?.[roundNumber]?.status === "waived";
              const hasStarted =
                hasScore ||
                (round?.round != null &&
                  (round.round > roundNumber ||
                    (round.round === roundNumber &&
                      round.status !== "not_started")));
              return (
                <div key={roundKey}>
                  <span>R{roundNumber}</span>
                  <strong>
                    {hasScore
                      ? scores[roundKey]
                      : isWaived
                        ? "Waived (0)"
                        : hasStarted
                          ? 0
                          : "–"}
                  </strong>
                </div>
              );
            })}
          </div>
        </article>
        <a
          className="cc-overview-card cc-rank-card"
          href="/leaderboard"
          onClick={(event) => {
            event.preventDefault();
            navigate("/leaderboard");
          }}
        >
          <p className="product-eyebrow">YOUR RANK</p>
          <h2>Live standings</h2>
          <strong>
            View leaderboard <span aria-hidden="true">↗</span>
          </strong>
          <span className="cc-rank-card__note">
            Check your place among teams
          </span>
        </a>
      </section>
      <section className="cc-play-section">
        <div className="cc-play-heading">
          <div>
            <p className="product-eyebrow">ROUND 01 / MINI GAMES</p>
            <h2>Play together</h2>
          </div>
          <span>Two-player cooperative (P1 / P2)</span>
        </div>
        <div className="cc-play-grid">
          <article className="cc-play-card cc-play-card--violet">
            <div className="cc-play-card__top">
              <span>01 / LOGIC</span>
              <span
                className={`cc-game-status cc-game-status--${circuitCompleted ? "completed" : r1Waived ? "completed" : roundOneRunning ? "available" : "locked"}`}
              >
                {circuitCompleted
                  ? "COMPLETED"
                  : r1Waived
                    ? "WAIVED"
                    : roundOneRunning
                      ? "LIVE"
                      : "LOCKED"}
              </span>
            </div>
            <h3>Circuit Sync</h3>
            <p>Trace the gates and solve each switch pattern together.</p>
            {r1Waived && !circuitCompleted && (
              <p className="cc-play-card__note">
                Round 1 requirement was administratively waived for your team.
              </p>
            )}
            <button
              className="cc-play-card__button"
              disabled={(!roundOneRunning && !r1Waived) || circuitCompleted}
              onClick={() => navigate("/dashboard/circuit-sync")}
            >
              {circuitCompleted
                ? "Completed"
                : r1Waived
                  ? "Play Practice"
                  : "Play Circuit Sync"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </article>
          <article className="cc-play-card cc-play-card--coral">
            <div className="cc-play-card__top">
              <span>02 / CO-OP</span>
              <span
                className={`cc-game-status cc-game-status--${mazeCompleted ? "completed" : roundOneRunning ? "available" : "locked"}`}
              >
                {mazeCompleted
                  ? "COMPLETED"
                  : roundOneRunning
                    ? "LIVE"
                    : "LOCKED"}
              </span>
            </div>
            <h3>Dual-Control Maze</h3>
            <p>Coordinate two controls to navigate one shared maze.</p>
            <button
              className="cc-play-card__button"
              disabled={!roundOneRunning || mazeCompleted}
              onClick={() => navigate("/dashboard/maze")}
            >
              {mazeCompleted ? "Completed" : "Play Dual-Control Maze"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </article>
          <article className="cc-play-card cc-play-card--sky">
            <div className="cc-play-card__top">
              <span>03 / REFLEX</span>
              <span
                className={`cc-game-status cc-game-status--${runnerCompleted ? "completed" : roundOneRunning ? "available" : "locked"}`}
              >
                {runnerCompleted
                  ? "COMPLETED"
                  : roundOneRunning
                    ? "LIVE"
                    : "LOCKED"}
              </span>
            </div>
            <h3>Cyber Runner</h3>
            <p>Work in sync to dodge obstacles and collect points.</p>
            <button
              className="cc-play-card__button"
              disabled={!roundOneRunning || runnerCompleted}
              onClick={() => navigate("/dashboard/runner")}
            >
              {runnerCompleted ? "Completed" : "Play Cyber Runner"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </article>
        </div>
      </section>
      <section className="cc-play-section">
        <div className="cc-play-heading">
          <div>
            <p className="product-eyebrow">ROUND 02 / WEB UI HIJACKING</p>
            <h2>Hidden Clue Investigation</h2>
          </div>
          <span>Inspect Element Sleuth</span>
        </div>
        <div className="cc-play-grid">
          <article className="cc-play-card cc-play-card--coral">
            <div className="cc-play-card__top">
              <span>02 / INVESTIGATION</span>
              <span
                className={`cc-game-status cc-game-status--${investigationCompleted ? "completed" : r2Waived ? "completed" : !r2PrereqMet ? "locked" : roundTwoRunning ? "available" : "locked"}`}
              >
                {investigationCompleted
                  ? "COMPLETED"
                  : r2Waived
                    ? "WAIVED"
                    : !r2PrereqMet
                      ? "PREREQ REQUIRED"
                      : roundTwoRunning
                        ? "LIVE"
                        : "LOCKED"}
              </span>
            </div>
            <h3>Operation Shadow Beacon</h3>
            <p>
              Trace the rogue relay, inspect mock web assets, and neutralize the
              campus beacon.
            </p>
            {!r2PrereqMet && (
              <p className="cc-play-card__note">
                Prerequisite required: Round 01 must be completed or waived by
                administrator.
              </p>
            )}
            {r2Waived && !investigationCompleted && (
              <p className="cc-play-card__note">
                Round 2 requirement was administratively waived for your team.
              </p>
            )}
            <button
              className="cc-play-card__button"
              disabled={
                !r2PrereqMet ||
                (!roundTwoRunning && !investigationCompleted && !r2Waived)
              }
              onClick={() => navigate("/dashboard/investigation")}
            >
              {investigationCompleted
                ? "Review Investigation"
                : !r2PrereqMet
                  ? "Prerequisite Required"
                  : "Play Investigation"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </article>
        </div>
      </section>

      <section className="cc-play-section">
        <div className="cc-play-heading">
          <div>
            <p className="product-eyebrow">ROUND 03 / DIGITAL DETECTIVE</p>
            <h2>Collaborative Case</h2>
          </div>
          <span>Lead Detective & Forensic Analyst</span>
        </div>
        <div className="cc-play-grid">
          <article className="cc-play-card cc-play-card--violet">
            <div className="cc-play-card__top">
              <span>01 / OSINT & SIEM</span>
              <span
                className={`cc-game-status cc-game-status--${roundThreeCompleted ? "completed" : roundThreeRunning || roundThreePaused ? "available" : "locked"}`}
              >
                {roundThreeCompleted
                  ? "COMPLETED"
                  : roundThreePaused
                    ? "PAUSED"
                    : roundThreeRunning
                      ? "LIVE"
                      : "LOCKED"}
              </span>
            </div>
            <h3>Cyber Incident Investigation</h3>
            <p>
              Analyze email dumps, authentication audit logs, netflow traces,
              and synthesize evidence on the shared case board.
            </p>
            {!r3PrereqMet && (
              <p className="cc-play-card__note">
                Prerequisite required: Round 02 must be completed or waived by
                administrator.
              </p>
            )}
            {r3Waived && !roundThreeCompleted && (
              <p className="cc-play-card__note">
                Round 3 requirement was administratively waived for your team.
              </p>
            )}
            <button
              className="cc-play-card__button"
              disabled={
                (!roundThreeRunning &&
                  !roundThreePaused &&
                  !roundThreeCompleted &&
                  !r3Waived) ||
                !r3PrereqMet
              }
              onClick={() => navigate("/dashboard/round3")}
            >
              {roundThreeCompleted
                ? "Review Investigation"
                : roundThreePaused
                  ? "View Paused Investigation"
                  : !r3PrereqMet
                    ? "Prerequisite Required"
                    : "Enter Investigation Workspace"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </article>
        </div>
      </section>

      <section className="cc-presence-card">
        <div>
          <p className="product-eyebrow">TEAM PRESENCE</p>
          <h2>Signal crew</h2>
        </div>
        <div>
          <span className="product-mono">ONE TEAM SESSION</span>
          <p>
            Both players participate together using this screen and keyboard.
          </p>
        </div>
        <Status online={data.team.online} />
      </section>
    </main>
  );
}

function LeaderboardScreen({ onBack, onLogout }) {
  const {
    data: board,
    error,
    updatedAt,
  } = useVisiblePolling(() => apiRequest("/api/leaderboard"));
  const now = useVisibleClock();

  useEffect(() => {
    if (error === "Authentication required") onLogout();
  }, [error, onLogout]);

  const retry = () => window.location.reload();

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        headers: { "X-Session-Role": "team" },
        body: JSON.stringify({ role: "team" }),
      });
    } finally {
      onLogout();
    }
  };

  if (!board && !error)
    return <LoadingState label="Loading live leaderboard…" />;
  if (!board) return <ErrorState message={error} onRetry={retry} />;
  const topThree = board.rows.slice(0, 3);
  const remainingRows = board.rows.slice(3);
  return (
    <main className="product-page cc-leaderboard-page">
      <div className="product-heading cc-leaderboard-heading">
        <div>
          <p className="product-eyebrow">LIVE EVENT / SCOREBOARD</p>
          <h1>Leaderboard</h1>
          <p className="product-subtitle">
            Ranked by round points. Bias Points are separate.
          </p>
        </div>
        <div className="cc-leaderboard-actions">
          <button className="product-btn product-btn--light" onClick={onBack}>
            Back to dashboard
          </button>
        </div>
      </div>
      <div className="cc-leaderboard-meta" aria-live="polite">
        <span>{formatUpdatedAgo(updatedAt, now)}</span>
      </div>
      {error && (
        <p className="cc-poll-offline" role="status">
          Offline — unable to refresh live leaderboard. {error}
        </p>
      )}
      {!board.rows.length ? (
        <section className="product-panel cc-leaderboard-empty">
          <p className="product-eyebrow">NO SCORES YET</p>
          <h2>The leaderboard is empty.</h2>
          <p>Active teams and rankings will appear here.</p>
        </section>
      ) : (
        <>
          <section
            className="cc-leaderboard-podium"
            aria-label="Top three teams"
          >
            {topThree.map((row, index) => (
              <article
                key={`${row.name}-${index}`}
                className={`product-panel cc-leaderboard-podium__card cc-leaderboard-podium__card--${index + 1} ${board.youIndex === index ? "is-you" : ""}`}
              >
                <span className="product-mono">
                  RANK {row.rank}
                  {board.youIndex === index ? " / YOUR TEAM" : ""}
                </span>
                <h2>{row.name}</h2>
                <strong className="cc-leaderboard-podium__total">
                  {row.total}
                </strong>
                <LeaderboardRoundDetails row={row} />
              </article>
            ))}
          </section>
          {remainingRows.length > 0 && (
            <section className="product-section">
              <div className="product-section-heading">
                <p className="product-eyebrow">RANK 4+</p>
                <h2>Team standings</h2>
              </div>
              <div className="table-wrap">
                <table className="product-table cc-leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>Bias Points</th>
                      <th>R1</th>
                      <th>R2</th>
                      <th>R3</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remainingRows.map((row, index) => {
                      const absoluteIndex = index + 3;
                      const isYou = board.youIndex === absoluteIndex;
                      return (
                        <tr
                          key={`${row.name}-${absoluteIndex}`}
                          className={isYou ? "is-you" : ""}
                        >
                          <td>{row.rank}</td>
                          <td className="cc-leaderboard-table__team">
                            {row.name}
                            {isYou && <small>YOUR TEAM</small>}
                          </td>
                          <td>{row.bias}</td>
                          <td>{formatLeaderboardRound(row.r1)}</td>
                          <td>{formatLeaderboardRound(row.r2)}</td>
                          <td>{formatLeaderboardRound(row.r3)}</td>
                          <td className="cc-leaderboard-table__total">
                            {row.total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function formatLeaderboardRound(points) {
  return points === null ? "–" : points;
}

function LeaderboardRoundDetails({ row }) {
  return (
    <dl className="cc-leaderboard-podium__details">
      {[
        ["BIAS", row.bias],
        ["R1", formatLeaderboardRound(row.r1)],
        ["R2", formatLeaderboardRound(row.r2)],
        ["R3", formatLeaderboardRound(row.r3)],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return "—:—";
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function circuitStorageKey(teamId, startedAt) {
  return `cypherclash:circuit:${teamId}:${startedAt}`;
}

function getActiveGameElapsedMs(game, round, serverOffsetMs, now) {
  if (!round || !game) return 0;
  const startedAtMs = new Date(game.startedAt).getTime();
  const completedPausesMs = Math.max(
    0,
    new Date(round.deadline).getTime() - new Date(game.deadline).getTime(),
  );
  const currentPauseMs =
    round.status === "paused" && round.pausedAt
      ? Math.max(0, now + serverOffsetMs - new Date(round.pausedAt).getTime())
      : 0;
  return Math.max(
    0,
    now + serverOffsetMs - startedAtMs - completedPausesMs - currentPauseMs,
  );
}

function DualControlMazeScreen({ onBack, onLogout }) {
  const { data: screenData, error: pollingError } = useVisiblePolling(
    async () => {
      const [team, score] = await Promise.all([
        apiRequest("/api/team/me"),
        apiRequest("/api/team/score"),
      ]);
      return { team, score };
    },
  );
  useEffect(() => {
    if (pollingError === "Authentication required") onLogout();
  }, [pollingError, onLogout]);

  if (!screenData && !pollingError)
    return <LoadingState label="Loading Dual-Control Maze…" />;
  if (!screenData)
    return (
      <ErrorState
        message={pollingError}
        onRetry={() => window.location.reload()}
      />
    );

  const mazeCompleted = Boolean(
    screenData.score?.games?.["maze"] || screenData.score?.games?.["1_maze"],
  );
  if (mazeCompleted) {
    const recordedScore =
      screenData.score?.games?.["maze"] ?? screenData.score?.games?.["1_maze"];
    return (
      <main className="product-page cc-circuit-page">
        <TimeLeftBanner round={screenData.team?.currentRound} serverNow={screenData.team?.serverNow} />
        <div className="product-heading cc-circuit-heading">
          <div>
            <p className="product-eyebrow">ROUND 01 / TEAM PUZZLE</p>
            <h1>Dual-Control Maze</h1>
            <p className="product-subtitle">Two players · One shared avatar</p>
          </div>
          <button className="product-btn product-btn--light" onClick={onBack}>
            Back to dashboard
          </button>
        </div>
        <section className="product-panel cc-circuit-finished">
          <p className="product-eyebrow">GAME COMPLETE</p>
          <h2>Vault exit reached.</h2>
          <strong>{recordedScore} POINTS</strong>
          <button className="product-btn product-btn--light" onClick={onBack}>
            Return to dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <MazeApp
      teamId={screenData.team.teamId}
      round={screenData.team?.currentRound}
      serverNow={screenData.team?.serverNow}
      onBack={onBack}
      onLogout={onLogout}
    />
  );
}

function CyberRunnerScreen({ onBack, onLogout }) {
  const { data: screenData, error: pollingError } = useVisiblePolling(
    async () => {
      const [team, score] = await Promise.all([
        apiRequest("/api/team/me"),
        apiRequest("/api/team/score"),
      ]);
      return { team, score };
    },
  );
  useEffect(() => {
    if (pollingError === "Authentication required") onLogout();
  }, [pollingError, onLogout]);

  if (!screenData && !pollingError)
    return <LoadingState label="Loading Cyber Runner…" />;
  if (!screenData)
    return (
      <ErrorState
        message={pollingError}
        onRetry={() => window.location.reload()}
      />
    );

  const runnerCompleted = Boolean(
    screenData.score?.games?.["runner"] ||
    screenData.score?.games?.["1_runner"],
  );
  if (runnerCompleted) {
    const recordedScore =
      screenData.score?.games?.["runner"] ??
      screenData.score?.games?.["1_runner"];
    return (
      <main className="product-page cc-circuit-page">
        <TimeLeftBanner round={screenData.team?.currentRound} serverNow={screenData.team?.serverNow} />
        <div className="product-heading cc-circuit-heading">
          <div>
            <p className="product-eyebrow">ROUND 01 / REFLEX SPRINT</p>
            <h1>Cyber Runner</h1>
            <p className="product-subtitle">Two players · Obstacle sprint</p>
          </div>
          <button className="product-btn product-btn--light" onClick={onBack}>
            Back to dashboard
          </button>
        </div>
        <section className="product-panel cc-circuit-finished">
          <p className="product-eyebrow">GAME COMPLETE</p>
          <h2>Finish line crossed.</h2>
          <strong>{recordedScore} POINTS</strong>
          <button className="product-btn product-btn--light" onClick={onBack}>
            Return to dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <RunnerApp
      teamId={screenData.team.teamId}
      round={screenData.team?.currentRound}
      serverNow={screenData.team?.serverNow}
      onBack={onBack}
      onLogout={onLogout}
    />
  );
}

function InvestigationScreen({ onBack, onLogout }) {
  const [teamLookup, setTeamLookup] = useState({
    loading: true,
    data: null,
    error: "",
  });

  useEffect(() => {
    let active = true;
    apiRequest("/api/team/me")
      .then((data) => {
        if (active) setTeamLookup({ loading: false, data, error: "" });
      })
      .catch((error) => {
        if (active)
          setTeamLookup({ loading: false, data: null, error: error.message });
      });
    return () => {
      active = false;
    };
  }, []);

  if (teamLookup.loading)
    return <LoadingState label="Loading your Case HELIX investigation…" />;
  if (!teamLookup.data && teamLookup.error !== "Authentication required") {
    return (
      <ErrorState
        message={teamLookup.error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <InvestigationApp
      teamId={teamLookup.data?.teamId || ""}
      round={teamLookup.data?.currentRound}
      serverNow={teamLookup.data?.serverNow}
      onBack={onBack}
      onLogout={onLogout}
    />
  );
}

function CircuitSyncGame({ onBack, onLogout }) {
  const {
    data: teamData,
    error: pollingError,
    updatedAt,
  } = useVisiblePolling(() => apiRequest("/api/team/me"));
  const now = useVisibleClock();
  const [game, setGame] = useState(null);
  const [inputs, setInputs] = useState([]);
  const [startState, setStartState] = useState({ loading: true, error: "" });
  const [finishState, setFinishState] = useState({
    loading: false,
    error: "",
    points: null,
  });
  const [inputMessage, setInputMessage] = useState("");
  const serverOffsetRef = useRef(0);
  const finishAttemptedRef = useRef(false);
  const inputLogRef = useRef([]);

  useEffect(() => {
    if (pollingError === "Authentication required") onLogout();
  }, [pollingError, onLogout]);

  useEffect(() => {
    if (!teamData?.teamId) return undefined;
    let active = true;
    const start = async () => {
      try {
        const result = await apiRequest("/api/games/circuit/start", {
          method: "POST",
          body: JSON.stringify({}),
        });
        if (!active) return;
        serverOffsetRef.current =
          new Date(result.serverNow).getTime() - Date.now();
        const key = circuitStorageKey(teamData.teamId, result.startedAt);
        const saved = window.localStorage.getItem(key);
        const savedInputs = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(savedInputs))
          throw new Error("Saved Circuit Sync input log is invalid");
        replayCircuit(result.seed, savedInputs);
        inputLogRef.current = savedInputs;
        setInputs(savedInputs);
        setGame({ ...result, key });
        setStartState({ loading: false, error: "" });
      } catch (error) {
        if (active) setStartState({ loading: false, error: error.message });
      }
    };
    void start();
    return () => {
      active = false;
    };
  }, [teamData?.teamId]);

  const round = teamData?.currentRound;
  const elapsedMs = game
    ? getActiveGameElapsedMs(game, round, serverOffsetRef.current, now)
    : 0;
  let replayedGame = null;
  let replayError = "";
  if (game) {
    try {
      replayedGame = replayCircuit(game.seed, inputs);
    } catch (error) {
      replayError = error.message;
    }
  }
  const circuitState = replayedGame
    ? getCircuitPublicState(replayedGame, elapsedMs)
    : null;

  const finish = async () => {
    if (!game || finishAttemptedRef.current) return;
    finishAttemptedRef.current = true;
    setFinishState({ loading: true, error: "", points: null });
    try {
      const result = await apiRequest("/api/games/circuit/finish", {
        method: "POST",
        body: JSON.stringify({ inputs: inputLogRef.current }),
      });
      setFinishState({ loading: false, error: "", points: result.points });
      window.localStorage.removeItem(game.key);
    } catch (error) {
      setFinishState({ loading: false, error: error.message, points: null });
    }
  };

  useEffect(() => {
    if (
      circuitState?.done &&
      finishState.points === null &&
      !finishState.loading &&
      !finishAttemptedRef.current
    ) {
      void finish();
    }
  }, [circuitState?.done, finishState.loading, finishState.points, game]);

  const recordInput = (type, idx) => {
    if (
      !game ||
      !circuitState ||
      circuitState.done ||
      finishState.loading ||
      finishState.points !== null
    )
      return;
    if (round?.status !== "running") {
      setInputMessage(
        "Inputs are disabled while the round is paused or ended.",
      );
      return;
    }
    const previousTimestamp = inputLogRef.current.at(-1)?.timestamp ?? -80;
    const timestamp = Math.max(0, Math.floor(elapsedMs));
    if (timestamp - previousTimestamp < 80) {
      setInputMessage("Wait a moment before entering the next circuit action.");
      return;
    }
    const input =
      type === "toggle" ? { type, idx, timestamp } : { type, timestamp };
    const nextInputs = [...inputLogRef.current, input];
    try {
      replayCircuit(game.seed, nextInputs);
      window.localStorage.setItem(game.key, JSON.stringify(nextInputs));
    } catch (error) {
      setInputMessage(
        error.message || "Unable to save Circuit Sync progress on this device.",
      );
      return;
    }
    inputLogRef.current = nextInputs;
    setInputs(nextInputs);
    setInputMessage("");
  };

  useEffect(() => {
    if (!game || !circuitState || circuitState.done) return undefined;
    const onKeyDown = (event) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey)
        return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
      )
        return;
      if (/^[1-6]$/.test(event.key)) {
        const switchIndex = Number(event.key) - 1;
        if (switchIndex < circuitState.switchCount) {
          event.preventDefault();
          recordInput("toggle", switchIndex);
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        recordInput("submit");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game, circuitState, round?.status, elapsedMs, finishState]);

  const currentRoundRemaining =
    !round || round.status === "not_started" || !round.deadline
      ? null
      : round.status === "ended"
        ? 0
        : Math.max(
            0,
            new Date(round.deadline).getTime() -
              (round.status === "paused" && round.pausedAt
                ? new Date(round.pausedAt).getTime()
                : now + serverOffsetRef.current),
          );
  const canAct =
    round?.status === "running" &&
    !finishState.loading &&
    finishState.points === null;

  if (startState.loading)
    return <LoadingState label="Preparing Circuit Sync…" />;
  if (startState.error) {
    return (
      <main className="product-page cc-circuit-page">
        <section className="product-panel state-panel">
          <p className="product-eyebrow">CIRCUIT SYNC UNAVAILABLE</p>
          <h1>Could not start the game.</h1>
          <FormMessage error={startState.error} />
          {pollingError && <FormMessage error={pollingError} />}
          <button className="product-btn product-btn--light" onClick={onBack}>
            Back to dashboard
          </button>
        </section>
      </main>
    );
  }
  if (replayError || !circuitState) {
    return (
      <ErrorState
        message={replayError || "Circuit Sync state is unavailable"}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <main className="product-page cc-circuit-page">
      <TimeLeftBanner round={round} serverNow={teamData?.serverNow} />
      <div className="product-heading cc-circuit-heading">
        <div>
          <p className="product-eyebrow">ROUND 01 / TEAM CIRCUIT PUZZLE</p>
          <h1>Circuit Sync</h1>
          <p className="product-subtitle">
            One shared screen. Think together, then enter the switch pattern.
          </p>
        </div>
        <button className="product-btn product-btn--light" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
      <div className="cc-poll-status" aria-live="polite">
        <span>{formatUpdatedAgo(updatedAt, now)}</span>
        <span>Round time {formatDuration(currentRoundRemaining)}</span>
        {pollingError && (
          <strong role="status">
            Offline — unable to refresh round status. {pollingError}
          </strong>
        )}
      </div>
      {round?.status === "paused" && (
        <p className="product-message is-error" role="status">
          Round paused — the puzzle is frozen until play resumes.
        </p>
      )}
      {round?.status === "ended" && (
        <p className="product-message is-error" role="status">
          The round has ended. Your unsubmitted run cannot be scored.
        </p>
      )}
      {circuitState.done ? (
        <section className="product-panel cc-circuit-finished">
          <p className="product-eyebrow">
            {finishState.points === null ? "VERIFYING RUN" : "GAME COMPLETE"}
          </p>
          <h2>
            {finishState.points === null
              ? "Checking your circuit log…"
              : "Team signal restored."}
          </h2>
          {finishState.points !== null && (
            <strong>{finishState.points} POINTS</strong>
          )}
          {finishState.error && (
            <>
              <FormMessage error={finishState.error} />
              <button
                className="product-btn product-btn--primary"
                onClick={() => {
                  finishAttemptedRef.current = false;
                  void finish();
                }}
              >
                Retry validation
              </button>
            </>
          )}
          {finishState.points !== null && (
            <button className="product-btn product-btn--light" onClick={onBack}>
              Return to dashboard
            </button>
          )}
        </section>
      ) : (
        <section className="product-panel cc-circuit-game">
          <div className="cc-circuit-game__meta">
            <span className="product-mono">
              STAGE {circuitState.stage} / {circuitState.stages}
            </span>
            <span>
              MISTAKES {circuitState.wrong} / {circuitState.maxWrong}
            </span>
            <span>{circuitState.switchCount} SWITCHES</span>
          </div>
          <div className="cc-circuit-cooperation">
            <strong>Two-player solve</strong>
            <span>
              Player 1 reads the gates and calls the pattern. Player 2 enters it
              using keys 1–6, then Enter to test. Swap roles between stages if
              you like.
            </span>
          </div>
          <div className="cc-circuit-puzzle">
            <section>
              <h2>Trace the circuit</h2>
              <p className="cc-circuit-stage-title">{circuitState.title}</p>
              <CircuitDiagram state={circuitState} />
            </section>
            <section className="cc-circuit-inputs">
              <h2>Set the switches</h2>
              <p>Press a number key or use its button to toggle a switch.</p>
              <div className="cc-circuit-switches">
                {circuitState.switches.map((active, index) => (
                  <button
                    className={`cc-circuit-switch ${active ? "is-on" : ""}`}
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label={`Switch ${index + 1} ${active ? "on" : "off"}`}
                    disabled={!canAct}
                    onClick={() => recordInput("toggle", index)}
                    key={index}
                  >
                    <span className="cc-circuit-switch__track">
                      <i />
                    </span>
                    <span>
                      S{index + 1}
                      <small>
                        {active ? "ON" : "OFF"} · KEY {index + 1}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              {circuitState.lastFeedback && (
                <p className="cc-circuit-feedback" role="status">
                  {circuitState.lastFeedback.correct} of{" "}
                  {circuitState.lastFeedback.of} lamps matched. Check the gate
                  chain and try again.
                </p>
              )}
              {circuitState.lockedMs > 0 && (
                <p className="cc-circuit-feedback">
                  Next submission in {Math.ceil(circuitState.lockedMs / 1000)}s.
                </p>
              )}
              <button
                className="product-btn product-btn--primary"
                disabled={!canAct || circuitState.lockedMs > 0}
                onClick={() => recordInput("submit")}
              >
                Test circuit <span>· Press Enter</span>
              </button>
            </section>
          </div>
          {inputMessage && (
            <p className="product-message is-error" role="status">
              {inputMessage}
            </p>
          )}
          {finishState.error && <FormMessage error={finishState.error} />}
        </section>
      )}
    </main>
  );
}

function CircuitDiagram({ state }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [pinnedNode, setPinnedNode] = useState(null);
  const layout = buildCircuitSchematic(state);
  const activeNode = hoveredNode || pinnedNode;

  return (
    <div className="cc-circuit-schematic">
      <div
        className="cc-circuit-diagram"
        aria-label="Circuit schematic; focus or select a node to trace its wires"
      >
        <svg
          viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.width} ${layout.viewBox.height}`}
          role="group"
          aria-label="Circuit diagram"
        >
          {layout.wires.map((wire) => {
            const related =
              activeNode &&
              (wire.source === activeNode || wire.target === activeNode);
            return (
              <g
                className={`cc-circuit-wire-group${activeNode && !related ? " is-dimmed" : ""}${related ? " is-highlighted" : ""}`}
                key={wire.id}
              >
                <path className="cc-circuit-wire" d={wire.path} />
                <circle
                  className="cc-circuit-port"
                  cx={wire.sourcePoint.x}
                  cy={wire.sourcePoint.y}
                  r="3"
                />
                <circle
                  className="cc-circuit-port"
                  cx={wire.targetPoint.x}
                  cy={wire.targetPoint.y}
                  r="3"
                />
              </g>
            );
          })}
          {layout.nodes.map((node) => {
            const selected = activeNode === node.id;
            const active = node.type === "switch" && state.switches[node.index];
            const targetLabel =
              node.type === "lamp"
                ? `, target ${node.target ? "on" : "off"}`
                : "";
            return (
              <g
                className={`cc-circuit-node cc-circuit-node--${node.type}${active ? " is-on" : ""}${selected ? " is-selected" : ""}${activeNode && !selected ? " is-dimmed" : ""}`}
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                tabIndex="0"
                role="button"
                aria-label={`${node.id}${node.type === "gate" ? ` ${node.gate.op} gate` : ""}${targetLabel}`}
                aria-pressed={pinnedNode === node.id}
                onPointerEnter={() => setHoveredNode(node.id)}
                onPointerLeave={() => setHoveredNode(null)}
                onFocus={() => setHoveredNode(node.id)}
                onBlur={() => setHoveredNode(null)}
                onClick={() =>
                  setPinnedNode((current) =>
                    current === node.id ? null : node.id,
                  )
                }
              >
                {node.type === "lamp" ? (
                  <>
                    <circle
                      className={`cc-circuit-lamp${node.target ? " is-on" : ""}`}
                      cx="20"
                      cy={node.height / 2}
                      r="12"
                    />
                    <text
                      className="cc-circuit-node-label cc-circuit-lamp-label"
                      x="42"
                      y={node.height / 2 + 4}
                    >
                      {node.id}
                      {node.target === undefined
                        ? ""
                        : ` · ${node.target ? "ON" : "OFF"}`}
                    </text>
                  </>
                ) : (
                  <>
                    <rect
                      className="cc-circuit-node-box"
                      x="0"
                      y="0"
                      width={node.width}
                      height={node.height}
                      rx="8"
                    />
                    <text
                      className="cc-circuit-node-label"
                      x={node.width / 2}
                      y={node.height / 2 + 4}
                      textAnchor="middle"
                    >
                      {node.type === "gate" ? node.gate.op : node.id}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function InvestigationGame({ onBack, onLogout }) {
  const {
    data: teamData,
    error: pollingError,
    updatedAt,
  } = useVisiblePolling(() => apiRequest("/api/team/me"));
  const now = useVisibleClock();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmingHint, setConfirmingHint] = useState(false);
  const [requestingHint, setRequestingHint] = useState(false);
  const [feedback, setFeedback] = useState({ error: "", success: "" });
  const serverOffsetRef = useRef(0);

  const loadState = async () => {
    try {
      const res = await apiRequest("/api/rounds/2/investigation/state");
      setState(res);
      if (res.serverNow) {
        serverOffsetRef.current =
          new Date(res.serverNow).getTime() - Date.now();
      }
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to load investigation state");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pollingError === "Authentication required") onLogout();
  }, [pollingError, onLogout]);

  useEffect(() => {
    void loadState();
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setFeedback({ error: "", success: "" });
    try {
      await apiRequest("/api/rounds/2/investigation/start", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadState();
    } catch (err) {
      setFeedback({ error: err.message, success: "" });
    } finally {
      setStarting(false);
    }
  };

  const handleRequestHint = async () => {
    if (!state?.session || requestingHint) return;
    setRequestingHint(true);
    try {
      const res = await apiRequest("/api/rounds/2/investigation/hint", {
        method: "POST",
        body: JSON.stringify({ stage: state.session.stage }),
      });
      setConfirmingHint(false);
      setFeedback({
        error: "",
        success: res.message || "Tactical hint unlocked.",
      });
      await loadState();
    } catch (err) {
      setFeedback({
        error: err.message || "Failed to request hint.",
        success: "",
      });
      setConfirmingHint(false);
    } finally {
      setRequestingHint(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!answer.trim() || submitting || !state?.session) return;
    setSubmitting(true);
    setFeedback({ error: "", success: "" });
    const currentStage = state.session.stage;
    try {
      const res = await apiRequest("/api/rounds/2/investigation/submit", {
        method: "POST",
        body: JSON.stringify({ stage: currentStage, answer: answer.trim() }),
      });
      setAnswer("");
      setFeedback({
        error: "",
        success: res.completed
          ? "Final flag confirmed! Signal neutralized. Investigation complete!"
          : res.message ||
            "Lead verified! Next investigation resource unlocked.",
      });
      await loadState();
    } catch (err) {
      setFeedback({
        error:
          err.message || "Incorrect answer. Check the resource and try again.",
        success: "",
      });
      await loadState();
    } finally {
      setSubmitting(false);
    }
  };

  const round = teamData?.currentRound;
  const currentRoundRemaining =
    !round || round.status === "not_started" || !round.deadline
      ? null
      : round.status === "ended"
        ? 0
        : Math.max(
            0,
            new Date(round.deadline).getTime() -
              (round.status === "paused" && round.pausedAt
                ? new Date(round.pausedAt).getTime()
                : now + serverOffsetRef.current),
          );

  if (loading && !state)
    return <LoadingState label="Preparing investigation environment…" />;
  if (error && !state)
    return <ErrorState message={error} onRetry={loadState} />;

  const isRoundTwoRunning = round?.round === 2 && round?.status === "running";
  const isRoundTwoPaused = round?.round === 2 && round?.status === "paused";
  const isRoundTwoEnded = round?.round === 2 && round?.status === "ended";
  const isLocked =
    !round || round.round !== 2 || round.status === "not_started";

  return (
    <main className="product-page cc-investigation-page">
      <TimeLeftBanner round={round} serverNow={teamData?.serverNow} />
      <div className="product-heading cc-circuit-heading">
        <div>
          <p className="product-eyebrow">ROUND 02 / WEB UI HIJACKING</p>
          <h1>Operation Shadow Beacon</h1>
          <p className="product-subtitle">
            Trace the rogue campus relay, inspect hidden web elements, and
            neutralize the signal.
          </p>
        </div>
        <button className="product-btn product-btn--light" onClick={onBack}>
          Back to dashboard
        </button>
      </div>

      <div className="cc-poll-status" aria-live="polite">
        <span>{formatUpdatedAgo(updatedAt, now)}</span>
        <span>Round time {formatDuration(currentRoundRemaining)}</span>
        {pollingError && (
          <strong role="status">
            Offline — unable to refresh round status. {pollingError}
          </strong>
        )}
      </div>

      {isRoundTwoPaused && (
        <p className="product-message is-error" role="status">
          Round paused — the investigation is frozen until play resumes.
        </p>
      )}
      {isRoundTwoEnded && (
        <p className="product-message is-error" role="status">
          Round 2 has ended. Submissions are no longer accepted.
        </p>
      )}
      {isLocked && (
        <section className="product-panel state-panel">
          <p className="product-eyebrow">ROUND LOCKED</p>
          <h2>Round 2 is not currently active</h2>
          <p>
            The investigation workspace opens as soon as the event
            administrators start Round 2.
          </p>
          <button className="product-btn product-btn--primary" onClick={onBack}>
            Return to dashboard
          </button>
        </section>
      )}

      {!isLocked && state?.status === "not_started" && (
        <section className="product-panel cc-investigation-brief">
          <p className="product-eyebrow">INVESTIGATION BRIEFING</p>
          <h2>Rogue Relay Detected on Campus Network</h2>
          <p>
            An unauthorized beacon has been transmitting encrypted telemetry
            from within the campus infrastructure. Security Operations flagged
            an anomalous traffic burst, but the origin remains obfuscated. Your
            team must inspect the internal security portal, advisory diagrams,
            diagnostic consoles, and vault signatures using your browser
            DevTools to trace the origin and submit the neutralization flag.
          </p>
          <div style={{ marginTop: "20px" }}>
            <button
              className="product-btn product-btn--primary"
              disabled={!isRoundTwoRunning || starting}
              onClick={handleStart}
            >
              {starting ? "Initializing Session…" : "Begin Investigation"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      )}

      {!isLocked && state?.status === "expired" && (
        <section className="product-panel state-panel">
          <p className="product-eyebrow">SESSION EXPIRED</p>
          <h2>Investigation Deadline Passed</h2>
          <p>
            The allotted time for Round 2 has elapsed. This session has expired.
          </p>
          <button className="product-btn product-btn--light" onClick={onBack}>
            Return to dashboard
          </button>
        </section>
      )}

      {!isLocked &&
        (state?.status === "active" || state?.status === "submitted") && (
          <>
            <section className="cc-investigation-brief">
              <p className="product-eyebrow">INCIDENT CASE #CC-2026-0814</p>
              <h2>Objective: Trace & Neutralize Rogue Beacon</h2>
              <p>
                Work sequentially through each lead. Open the designated
                simulated resource in a new tab, use your browser inspect tools
                (right-click inspect or DevTools) to find the hidden comment,
                metadata, or override token, then submit each answer below.
              </p>
            </section>

            <div className="cc-investigation-grid">
              <section
                className="cc-clue-board"
                aria-label="Investigation leads"
              >
                {state.clues?.map((clue) => {
                  const isSolved = clue.status === "solved";
                  const isActive = clue.status === "active";
                  return (
                    <article
                      key={clue.stage}
                      className={`cc-clue-card cc-clue-card--${clue.status}`}
                    >
                      <div className="cc-clue-card__header">
                        <span className="product-mono">LEAD 0{clue.stage}</span>
                        <span
                          className={`cc-clue-badge cc-clue-badge--${clue.status}`}
                        >
                          {isSolved
                            ? "✓ SOLVED"
                            : isActive
                              ? "● ACTIVE LEAD"
                              : "LOCKED"}
                        </span>
                      </div>
                      <h3>{clue.title}</h3>
                      <p>{clue.prompt}</p>
                      {clue.resource && (
                        <div className="cc-resource-links">
                          <a
                            className="product-btn product-btn--small product-btn--primary"
                            href={clue.resource}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open Resource in New Tab ↗
                          </a>
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>

              <aside className="cc-investigation-submit-box">
                {state.status === "submitted" ? (
                  <div style={{ textAlign: "center" }}>
                    <p className="product-eyebrow">MISSION COMPLETE</p>
                    <h3 style={{ color: "#d4f04a", fontSize: "22px" }}>
                      Signal Neutralized
                    </h3>
                    <p>
                      All leads verified! The rogue relay has been neutralized
                      and your investigation report submitted.
                    </p>
                    <dl
                      className="cc-leaderboard-podium__details"
                      style={{ margin: "20px 0" }}
                    >
                      <div>
                        <dt>Leads</dt>
                        <dd>4 / 4</dd>
                      </div>
                      <div>
                        <dt>Wrong Attempts</dt>
                        <dd>{state.session?.wrongAttempts || 0}</dd>
                      </div>
                      <div>
                        <dt>Hints Used</dt>
                        <dd>{state.session?.hintsUsed || 0} / 1</dd>
                      </div>
                      <div>
                        <dt>Final Score</dt>
                        <dd>{state.session?.score ?? 500} pts</dd>
                      </div>
                    </dl>
                    <button
                      className="product-btn product-btn--primary"
                      onClick={onBack}
                    >
                      Return to dashboard
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <p className="product-eyebrow">
                      LEAD 0{state.session?.stage} / VERIFICATION
                    </p>
                    <h3>Submit Discovered Answer</h3>
                    <p>
                      {state.session?.stage === 4
                        ? "Enter the final discovered keyword from the illuminated vault stream."
                        : "Enter the exact identifier or key discovered in the inspected resource."}
                    </p>

                    <label className="cc-investigation-field">
                      <span>
                        {state.session?.stage === 4
                          ? "SECRET KEYWORD"
                          : "ANSWER KEY"}
                      </span>
                      <input
                        required
                        value={answer}
                        disabled={submitting || !isRoundTwoRunning}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={
                          state.session?.stage === 4
                            ? "Enter discovered keyword…"
                            : "Enter answer…"
                        }
                      />
                    </label>

                    {feedback.error && (
                      <p className="product-message is-error" role="status">
                        {feedback.error}
                      </p>
                    )}
                    {feedback.success && (
                      <p className="product-message is-success" role="status">
                        {feedback.success}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="product-btn product-btn--primary"
                      disabled={
                        submitting || !isRoundTwoRunning || !answer.trim()
                      }
                      style={{ width: "100%" }}
                    >
                      {submitting ? "Verifying…" : "Submit Answer"}{" "}
                      <span>↗</span>
                    </button>

                    <div className="cc-hint-box">
                      <strong>Tactical Hint (Round 2 Entitlement)</strong>
                      {state.session?.hintsUsed === 0 ? (
                        confirmingHint ? (
                          <div className="cc-hint-confirm">
                            <p>
                              <strong>
                                Confirm Hint for Lead 0{state.session?.stage}?
                              </strong>
                              <br />
                              Consuming this hint incurs an irreversible{" "}
                              <strong>-25 point penalty</strong> and uses your
                              team's single hint for Round 2.
                            </p>
                            <div className="cc-hint-actions">
                              <button
                                type="button"
                                className="product-btn product-btn--small product-btn--primary"
                                disabled={requestingHint || !isRoundTwoRunning}
                                onClick={handleRequestHint}
                              >
                                {requestingHint
                                  ? "Unlocking…"
                                  : "Confirm & Deduct 25 Pts"}
                              </button>
                              <button
                                type="button"
                                className="product-btn product-btn--small product-btn--light"
                                disabled={requestingHint}
                                onClick={() => setConfirmingHint(false)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span>
                              1 hint available for this round (-25 pt penalty).
                            </span>
                            <div style={{ marginTop: "8px" }}>
                              <button
                                type="button"
                                className="product-btn product-btn--small product-btn--light"
                                disabled={!isRoundTwoRunning}
                                onClick={() => setConfirmingHint(true)}
                              >
                                Request Tactical Hint (-25 pts)
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="cc-hint-revealed">
                          <strong>
                            Tactical Hint{" "}
                            {state.session?.revealedHint
                              ? `(Lead 0${state.session.revealedHint.stage})`
                              : ""}{" "}
                            [-25 Pts Applied]
                          </strong>
                          {state.session?.revealedHint ? (
                            <p>{state.session.revealedHint.text}</p>
                          ) : (
                            <p>Tactical hint already consumed for Round 2.</p>
                          )}
                          <small>
                            1 of 1 hint used. No additional hints available this
                            round.
                          </small>
                        </div>
                      )}
                    </div>
                  </form>
                )}
              </aside>
            </div>
          </>
        )}
    </main>
  );
}

const FORENSIC_EVIDENCE_ITEMS = [
  {
    id: "exhibit-01",
    exhibit: "EXHIBIT 01",
    category: "Timeline Dossier",
    group: "documents",
    title: "Campus Incident Timeline",
    caption: "Incident Ref #CC-2026-0814 Operational Timeline (UTC)",
    image: "/assets/forensic/doc-incident-timeline.svg",
    type: "document",
    width: 245,
    minHeight: 290,
    xPercent: 2.5,
    yPercent: 3,
    rotation: -1.5,
    zIndex: 2,
    badgeColor: "#0ea5e9",
    description:
      "Official IT Security Incident Dossier outlining the chronological sequence of events, network alert triggers, and identified timeline discrepancies between Door B-04 and CCTV CAM-04.",
    details: [
      { label: "Incident Ref", value: "#CC-2026-0814" },
      { label: "Date / Time", value: "2026-08-14 02:58 - 03:17 UTC" },
      { label: "Location", value: "Building C (Computing), Room B-04" },
      {
        label: "Timeline Anomaly",
        value:
          "03:14:38 UTC CAM-04 recording shows empty aisle despite 03:14:02 network intrusion alert and 03:09:40 door unlock.",
      },
    ],
  },
  {
    id: "exhibit-02",
    exhibit: "EXHIBIT 02",
    category: "CCTV Surveillance",
    group: "photos",
    title: "CAM-04 Server Room Capture",
    caption: "Fisheye Still // Server Rack B-04 // 03:14:38 UTC",
    image: "/assets/forensic/cctv-server-rack.jpg",
    type: "photo",
    width: 225,
    minHeight: 185,
    xPercent: 26,
    yPercent: 3.5,
    rotation: 2.2,
    zIndex: 4,
    tape: "top-left",
    badgeColor: "#ef4444",
    description:
      "Surveillance frame captured from CCTV Camera 04 overlooking Server Rack B-04 at 03:14:38 UTC. The aisle appears motionless despite high-volume ingress traffic.",
    details: [
      { label: "Camera ID", value: "CAM-04 (IP-10.14.88.24)" },
      { label: "Recorded Timestamp", value: "2026-08-14 03:14:38.000 UTC" },
      { label: "Field of View", value: "Server Room B-04, Rack Aisle A & B" },
      {
        label: "Examiner Note",
        value:
          "Visual stream appears static; zero frame jitter detected in live feed, indicating synthetic freeze.",
      },
    ],
  },
  {
    id: "exhibit-03",
    exhibit: "EXHIBIT 03",
    category: "CCTV Surveillance",
    group: "photos",
    title: "CAM-02 Corridor Capture",
    caption: "Monochrome Still // North Corridor Outside Door B-04",
    image: "/assets/forensic/cctv-corridor.jpg",
    type: "photo",
    width: 220,
    minHeight: 180,
    xPercent: 49.5,
    yPercent: 3,
    rotation: -2.8,
    zIndex: 3,
    tape: "top-right",
    badgeColor: "#ef4444",
    description:
      "Black-and-white infrared surveillance capture from hallway camera CAM-02 showing motion blur outside Door B-04 at 03:14:15 UTC.",
    details: [
      { label: "Camera ID", value: "CAM-02 (IP-10.14.88.22)" },
      { label: "Recorded Timestamp", value: "2026-08-14 03:14:15.820 UTC" },
      {
        label: "Sensor Trigger",
        value: "Passive Infrared Motion Detector #12",
      },
      {
        label: "Observation",
        value:
          "Shadowed silhouette entering doorway threshold at 03:14:16 UTC.",
      },
    ],
  },
  {
    id: "exhibit-04",
    exhibit: "EXHIBIT 04",
    category: "Access Control",
    group: "documents",
    title: "Door B-04 Access Reader Log",
    caption: "Reader CC-RD-04 Audit Export // Sub-Basement B-04",
    image: "/assets/forensic/doc-access-logs.svg",
    type: "document",
    width: 240,
    minHeight: 280,
    xPercent: 73,
    yPercent: 3.5,
    rotation: 1.4,
    zIndex: 5,
    badgeColor: "#38bdf8",
    description:
      "Door reader transaction log for Sub-Basement Room B-04 showing badge swipe events and magnetic door reed switch states.",
    details: [
      { label: "Door Controller", value: "CC-RD-04 (Firmware v4.19-SEC)" },
      {
        label: "Suspicious Swipe",
        value: "03:09:40 UTC - Badge #FAC-9412 (Contract HVAC)",
      },
      {
        label: "Reed Switch Alert",
        value: "03:14:18 UTC - ALERT: DOOR PROPPED",
      },
      { label: "Door Secured", value: "03:16:50 UTC - NORMAL: CLOSED" },
    ],
  },
  {
    id: "exhibit-05",
    exhibit: "EXHIBIT 05",
    category: "Network Telemetry",
    group: "documents",
    title: "Gateway Flow Telemetry",
    caption: "Pflow Flow Capture // GATEWAY-ALPHA (10.14.0.1)",
    image: "/assets/forensic/doc-network-flow.svg",
    type: "document",
    width: 245,
    minHeight: 260,
    xPercent: 74,
    yPercent: 36,
    rotation: -1.2,
    zIndex: 2,
    badgeColor: "#10b981",
    description:
      "Packet flow telemetry report from border gateway router showing anomalous high-bandwidth bridge flow FL-88192 on TCP/8443.",
    details: [
      { label: "Host Router", value: "GATEWAY-ALPHA (10.14.0.1)" },
      {
        label: "Flagged Flow",
        value: "FL-88192* [10.14.99.12:8443 -> 10.14.0.1:8443]",
      },
      { label: "Payload Vol", value: "42,881 packets / 64.2 MB" },
      {
        label: "Decoy Signature",
        value: "FLOW-TOKEN-991 (Session Decoy Marker)",
      },
    ],
  },
  {
    id: "exhibit-06",
    exhibit: "EXHIBIT 06",
    category: "Digital Forensics Unit",
    group: "documents",
    title: "DFU Video Authentication Report",
    caption: "Technical Report DFU-REP-2026-042 // State Crime Laboratory",
    image: "/assets/forensic/doc-forensic-report.svg",
    type: "document",
    width: 265,
    minHeight: 330,
    xPercent: 46,
    yPercent: 26,
    rotation: -0.6,
    zIndex: 7,
    tape: "top",
    badgeColor: "#f59e0b",
    description:
      "Digital Forensics Unit (DFU) Technical Report DFU-REP-2026-042 by Specialist Elena Rostova. Documents the forensic recovery of the displaced video frame sequence and cryptographic container marker.",
    details: [
      { label: "Report Ref", value: "DFU-REP-2026-042" },
      { label: "Investigator", value: "Specialist Elena Rostova (DFU #44)" },
      {
        label: "Target Asset",
        value: "CCTV DVR Drive #02 (CAM-04 Server Room B-04)",
      },
      {
        label: "Excised Range",
        value: "03:14:20.104 - 03:14:44.892 UTC (25 frames substituted)",
      },
      { label: "Injection Offset", value: "0x24F008 [BUS TAP BRIDGE]" },
      {
        label: "Displaced Frame Marker",
        value: "Recorded in report vector header and forensic findings",
      },
      {
        label: "Status",
        value: "AUTHENTICATED // SUBMITTED TO INCIDENT DOSSIER",
      },
    ],
  },
  {
    id: "exhibit-07",
    exhibit: "EXHIBIT 07",
    category: "Physical Evidence",
    group: "physical",
    title: "Hardware Ethernet Tap Splicer",
    caption: "Evidence #EV-8820-B // In-Line Network Tap",
    image: "/assets/forensic/hardware-network-tap.jpg",
    type: "photo",
    width: 215,
    minHeight: 185,
    xPercent: 2,
    yPercent: 37,
    rotation: 3.1,
    zIndex: 3,
    tape: "top-left",
    badgeColor: "#eab308",
    description:
      "Seized physical hardware Ethernet tap device found spliced into switch port G1/0/4 inside Server Rack B-04. Provided clandestine packet capture and video injection bus bridge.",
    details: [
      {
        label: "Evidence Item",
        value: "EV-8820-B (Sealed Plastic Forensic Bag)",
      },
      {
        label: "Recovery Site",
        value: "Server Rack B-04, Switch #04, Port G1/0/4",
      },
      {
        label: "Device Specs",
        value: "Dual RJ45 Passthrough with Micro-FPGA Tap Controller",
      },
      { label: "Forensic Hash", value: "SHA-1: 9c2b4e81a073f1d4" },
    ],
  },
  {
    id: "exhibit-08",
    exhibit: "EXHIBIT 08",
    category: "Physical Evidence",
    group: "physical",
    title: "Tampered Switch Chassis",
    caption: "Evidence #EV-8820-E // Breached Switch Enclosure",
    image: "/assets/forensic/hardware-tamper-switch.jpg",
    type: "photo",
    width: 220,
    minHeight: 195,
    xPercent: 24,
    yPercent: 35,
    rotation: -2.1,
    zIndex: 4,
    badgeColor: "#eab308",
    description:
      "Cisco Catalyst switch chassis with security tamper tape sliced and jumper wire leads installed onto the motherboard diagnostic serial header.",
    details: [
      { label: "Hardware Model", value: "Catalyst 3850 48-Port PoE+" },
      {
        label: "Tamper Marker",
        value: "Evidence Marker #4 placed at jumper tap point",
      },
      {
        label: "Inspection Note",
        value:
          "Serial console bridge allowed root shell execution without radius credential logging.",
      },
    ],
  },
  {
    id: "exhibit-09",
    exhibit: "EXHIBIT 09",
    category: "Physical Evidence",
    group: "physical",
    title: "Seized Cloned RFID Keycard",
    caption: "Evidence #EV-8820-C // Cloned Facility Card",
    image: "/assets/forensic/smartcard-badge-bag.jpg",
    type: "photo",
    width: 210,
    minHeight: 190,
    xPercent: 51,
    yPercent: 65,
    rotation: 2.6,
    zIndex: 4,
    tape: "top-right",
    badgeColor: "#eab308",
    description:
      "Sealed evidence bag containing blank white 13.56 MHz RFID smartcard cloned with credentials of Facilities contractor badge #FAC-9412.",
    details: [
      { label: "Evidence Item", value: "EV-8820-C" },
      { label: "RFID UID", value: "04:A2:81:F2:90:3B:80" },
      { label: "Cloned Persona", value: "HVAC Maint / Badge #FAC-9412" },
      { label: "Recovery Site", value: "Basement Fire Stairwell Landing B2" },
    ],
  },
  {
    id: "exhibit-10",
    exhibit: "EXHIBIT 10",
    category: "Witness Statement",
    group: "documents",
    title: "Officer Vance Witness Statement",
    caption: "DPS Form DPS-WT-01 // Recorded Testimony Excerpt",
    image: "/assets/forensic/doc-officer-statement.svg",
    type: "document",
    width: 240,
    minHeight: 270,
    xPercent: 74,
    yPercent: 66,
    rotation: -1.8,
    zIndex: 3,
    badgeColor: "#a855f7",
    description:
      "Official recorded witness testimony of Security Officer Marcus Vance (Badge #408) detailing the visual video glitch on CAM-04 at 03:14 UTC.",
    details: [
      {
        label: "Declarant",
        value: "Security Officer Marcus Vance (Badge #408)",
      },
      { label: "Interviewer", value: "Det. R. Cross (Badge #812)" },
      {
        label: "Testimony Core",
        value:
          "Saw Camera 04 hitch and freeze momentarily at 03:14 UTC; room appeared still despite door propped alarm.",
      },
      {
        label: "Follow-up Action",
        value:
          "Corroborates PTS jitter and points directly to DFU Video Report DFU-REP-2026-042.",
      },
    ],
  },
  {
    id: "exhibit-11",
    exhibit: "EXHIBIT 11",
    category: "Investigator Notes",
    group: "documents",
    title: "Det. Cross Case Notebook",
    caption: "Yellow Legal Pad // Case #CC-2026-0814 Notes",
    image: "/assets/forensic/doc-investigator-notes.svg",
    type: "document",
    width: 245,
    minHeight: 290,
    xPercent: 3,
    yPercent: 65,
    rotation: 1.8,
    zIndex: 5,
    badgeColor: "#eab308",
    description:
      "Handwritten working notes of Detective R. Cross highlighting timeline contradictions between CAM-04 video and badge door logs, explicitly directing attention to Report DFU-REP-2026-042.",
    details: [
      { label: "Investigator", value: "Det. R. Cross (Evidence Division)" },
      {
        label: "Key Note 1",
        value:
          "Contradiction: Badge #FAC-9412 entered at 03:09, network peaked at 03:14, but CCTV shows empty room!",
      },
      {
        label: "Key Note 2",
        value: "Video was spliced/frozen. Sent raw DVR to Specialist Rostova.",
      },
      {
        label: "Crucial Directive",
        value:
          "See Report DFU-REP-2026-042 for the displaced container frame marker!",
      },
    ],
  },
  {
    id: "exhibit-12",
    exhibit: "EXHIBIT 12",
    category: "Evidence Inventory",
    group: "documents",
    title: "Chain of Custody Register",
    caption: "Master Repository Log // Vault-B Seizure Ledger",
    image: "/assets/forensic/doc-evidence-inventory.svg",
    type: "document",
    width: 240,
    minHeight: 270,
    xPercent: 27,
    yPercent: 64,
    rotation: -1.6,
    zIndex: 4,
    badgeColor: "#64748b",
    description:
      "Official police chain of custody register cataloging all physical and digital evidence seized during the Building C investigation.",
    details: [
      { label: "Registry Ref", value: "VAULT-B / #CC-2026-0814" },
      {
        label: "EV-8820-A",
        value: "CCTV DVR Hard Drive #02 -> Transferred to DFU LAB",
      },
      {
        label: "EV-8820-B",
        value: "Hardware Ethernet Tap & Splicer -> Vault Lock",
      },
      { label: "EV-8820-C", value: "Cloned RFID Access Keycard -> Vault Lock" },
    ],
  },
  {
    id: "exhibit-13",
    exhibit: "EXHIBIT 13",
    category: "Site Blueprint",
    group: "documents",
    title: "Sub-Basement Floorplan & Coverage",
    caption: "Building C Level 2 Blueprint // Sensor & Camera Topology",
    image: "/assets/forensic/doc-floorplan-topology.svg",
    type: "document",
    width: 255,
    minHeight: 255,
    xPercent: 25,
    yPercent: 6,
    rotation: 1.1,
    zIndex: 1,
    badgeColor: "#0284c7",
    description:
      "Sub-basement architectural blueprint showing physical camera angles, coverage cones for CAM-02 and CAM-04, server rack layouts, and door sensor locations.",
    details: [
      { label: "Floor Level", value: "Building C Sub-Basement (Level -2)" },
      { label: "Room Target", value: "Room B-04 (Core Academic Relay Hub)" },
      {
        label: "Blind Spots",
        value:
          "CAM-04 aisle cone partially obstructed by Rack B-03 cabling riser.",
      },
    ],
  },
];

function ForensicEvidenceDesk({ data }) {
  const [activeItem, setActiveItem] = useState(null);
  const [filterGroup, setFilterGroup] = useState("all");
  const [viewMode, setViewMode] = useState("desk"); // 'desk' | 'grid'
  const [imageZoomed, setImageZoomed] = useState(false);

  // Extract server-provided plate token if present in authorized data payload
  const serverPlateToken = useMemo(() => {
    const match = data?.html?.match(
      /<div class="cc-concealed-plate"[^>]*>([\s\S]*?)<\/div>/i,
    );
    return match ? match[1].trim() : "";
  }, [data]);

  const filteredItems = useMemo(() => {
    if (filterGroup === "all") return FORENSIC_EVIDENCE_ITEMS;
    return FORENSIC_EVIDENCE_ITEMS.filter((it) => it.group === filterGroup);
  }, [filterGroup]);

  // Keyboard navigation when modal is open
  useEffect(() => {
    if (!activeItem) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActiveItem(null);
        setImageZoomed(false);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIndex = FORENSIC_EVIDENCE_ITEMS.findIndex(
          (it) => it.id === activeItem.id,
        );
        const prevIndex =
          (currentIndex - 1 + FORENSIC_EVIDENCE_ITEMS.length) %
          FORENSIC_EVIDENCE_ITEMS.length;
        setActiveItem(FORENSIC_EVIDENCE_ITEMS[prevIndex]);
        setImageZoomed(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const currentIndex = FORENSIC_EVIDENCE_ITEMS.findIndex(
          (it) => it.id === activeItem.id,
        );
        const nextIndex = (currentIndex + 1) % FORENSIC_EVIDENCE_ITEMS.length;
        setActiveItem(FORENSIC_EVIDENCE_ITEMS[nextIndex]);
        setImageZoomed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeItem]);

  const navigateItem = (direction) => {
    if (!activeItem) return;
    const currentIndex = FORENSIC_EVIDENCE_ITEMS.findIndex(
      (it) => it.id === activeItem.id,
    );
    const newIndex =
      direction === "next"
        ? (currentIndex + 1) % FORENSIC_EVIDENCE_ITEMS.length
        : (currentIndex - 1 + FORENSIC_EVIDENCE_ITEMS.length) %
          FORENSIC_EVIDENCE_ITEMS.length;
    setActiveItem(FORENSIC_EVIDENCE_ITEMS[newIndex]);
    setImageZoomed(false);
  };

  return (
    <div className="mock-resource-container">
      <p className="product-eyebrow">
        CAMPUS IT SECURITY ADVISORY // SEC-ADVISORY-88
      </p>
      <h1>Forensic Evidence Investigation Board</h1>

      <div className="cc-riddle-quote">
        <p>
          "The incident was recorded, yet the timeline tells a different story.
          One witness saw the event, but its record does not quite align.
          Compare what the cameras captured with what the system recorded. Find
          the report that explains the displaced frame, and recover the
          identifier buried in its details."
        </p>
      </div>

      <p style={{ color: "#a3a3ad", lineHeight: 1.6 }}>
        Photographs, surveillance captures, telemetry traces, and classified
        documents from the campus relay incident have been compiled onto the
        forensic analysis desk. Examine and cross-reference the evidence
        documents. Compare the surveillance camera feeds with access logs and
        forensic notes to uncover the displaced frame report.
      </p>

      <div className="cc-evidence-board-wrapper">
        {/* Evidence Desk Toolbar */}
        <div className="cc-evidence-desk-toolbar">
          <div className="cc-desk-status">
            <span className="cc-desk-status-pill">FORENSIC DESK ACTIVE</span>
            <span>13 Exhibits Cataloged</span>
          </div>

          {/* Filter Pills */}
          <div
            className="cc-desk-filters"
            role="group"
            aria-label="Filter exhibits by category"
          >
            <button
              type="button"
              className={`cc-filter-pill ${filterGroup === "all" ? "cc-filter-pill--active" : ""}`}
              onClick={() => setFilterGroup("all")}
            >
              All Exhibits (13)
            </button>
            <button
              type="button"
              className={`cc-filter-pill ${filterGroup === "documents" ? "cc-filter-pill--active" : ""}`}
              onClick={() => setFilterGroup("documents")}
            >
              Reports & Logs (6)
            </button>
            <button
              type="button"
              className={`cc-filter-pill ${filterGroup === "photos" ? "cc-filter-pill--active" : ""}`}
              onClick={() => setFilterGroup("photos")}
            >
              Surveillance Stills (2)
            </button>
            <button
              type="button"
              className={`cc-filter-pill ${filterGroup === "physical" ? "cc-filter-pill--active" : ""}`}
              onClick={() => setFilterGroup("physical")}
            >
              Physical Seizures (3)
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="cc-desk-view-toggle">
            <button
              type="button"
              className={`cc-view-btn ${viewMode === "desk" ? "cc-view-btn--active" : ""}`}
              onClick={() => setViewMode("desk")}
              title="View evidence desk canvas"
            >
              Desk Canvas
            </button>
            <button
              type="button"
              className={`cc-view-btn ${viewMode === "grid" ? "cc-view-btn--active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="View evidence gallery list"
            >
              Gallery Grid
            </button>
          </div>
        </div>

        <div className="cc-desk-tip-banner">
          <span>
            [DIGITAL FORENSIC DESK]: Click or press Enter on any exhibit to open
            high-resolution report inspection. Use ← / → to cycle between
            evidence files.
          </span>
        </div>

        {/* View 1: Naturally Scattered Desk Canvas */}
        {viewMode === "desk" ? (
          <div className="cc-evidence-desk-viewport">
            <div className="cc-evidence-desk-static" id="evidence-board">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`cc-forensic-card cc-forensic-card--${item.type}`}
                  style={{
                    left: `${item.xPercent}%`,
                    top: `${item.yPercent}%`,
                    width: `${item.width}px`,
                    minHeight: `${item.minHeight}px`,
                    zIndex: item.zIndex,
                    transform: `rotate(${item.rotation}deg)`,
                  }}
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                  aria-label={`Inspect ${item.exhibit}: ${item.title}`}
                  onClick={() => setActiveItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveItem(item);
                    }
                  }}
                >
                  {item.tape && (
                    <div
                      className={`cc-photo-tape cc-photo-tape--${item.tape}`}
                    />
                  )}

                  <div className="cc-card-header">
                    <span
                      className="cc-card-badge"
                      style={{
                        backgroundColor: `${item.badgeColor}22`,
                        color: item.badgeColor,
                        borderColor: `${item.badgeColor}55`,
                      }}
                    >
                      {item.exhibit}
                    </span>
                    <span className="cc-card-category">{item.category}</span>
                  </div>

                  <div className="cc-card-media">
                    <img src={item.image} alt={item.title} loading="lazy" />
                    <div className="cc-card-hover-overlay">
                      <span>Click to Inspect Report ↗</span>
                    </div>
                  </div>

                  <div className="cc-card-footer">
                    <strong className="cc-card-title">{item.title}</strong>
                    <span className="cc-card-caption">{item.caption}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* View 2: Responsive Dossier Gallery Grid */
          <div className="cc-evidence-grid">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="cc-evidence-grid-item"
                tabIndex={0}
                role="button"
                aria-haspopup="dialog"
                aria-label={`Inspect ${item.exhibit}: ${item.title}`}
                onClick={() => setActiveItem(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveItem(item);
                  }
                }}
              >
                <div className="cc-grid-item-media">
                  <img src={item.image} alt={item.title} loading="lazy" />
                  <span
                    className="cc-card-badge"
                    style={{
                      backgroundColor: `${item.badgeColor}22`,
                      color: item.badgeColor,
                      borderColor: `${item.badgeColor}55`,
                    }}
                  >
                    {item.exhibit}
                  </span>
                </div>
                <div className="cc-grid-item-body">
                  <span className="cc-grid-item-category">{item.category}</span>
                  <h3 className="cc-grid-item-title">{item.title}</h3>
                  <p className="cc-grid-item-desc">{item.description}</p>
                  <button
                    type="button"
                    className="product-btn product-btn--small product-btn--light"
                  >
                    Examine Evidence ↗
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Forensic Inspection Modal Overlay */}
      {activeItem && (
        <div
          className="cc-forensic-modal-backdrop"
          onClick={() => {
            setActiveItem(null);
            setImageZoomed(false);
          }}
          role="presentation"
        >
          <div
            className="cc-forensic-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-modal-title"
          >
            {/* Modal Header */}
            <div className="cc-forensic-modal-header">
              <div className="cc-modal-title-group">
                <span
                  className="cc-card-badge"
                  style={{
                    backgroundColor: `${activeItem.badgeColor}25`,
                    color: activeItem.badgeColor,
                    borderColor: `${activeItem.badgeColor}66`,
                  }}
                >
                  {activeItem.exhibit}
                </span>
                <span className="cc-modal-category">{activeItem.category}</span>
                <h2 id="cc-modal-title" className="cc-modal-title">
                  {activeItem.title}
                </h2>
              </div>
              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-zoom-btn"
                  onClick={() => setImageZoomed((z) => !z)}
                  title={imageZoomed ? "Reset document view" : "Zoom document"}
                >
                  {imageZoomed ? "Fit View" : "Zoom 100%"}
                </button>
                <button
                  type="button"
                  className="cc-modal-close-btn"
                  onClick={() => {
                    setActiveItem(null);
                    setImageZoomed(false);
                  }}
                  aria-label="Close evidence inspection"
                >
                  ✕ Close [Esc]
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="cc-forensic-modal-body">
              {/* Document / Photo Viewer */}
              <div
                className={`cc-modal-doc-viewer ${imageZoomed ? "cc-modal-doc-viewer--zoomed" : ""}`}
              >
                <div className="cc-modal-image-wrapper">
                  <img
                    src={activeItem.image}
                    alt={activeItem.title}
                    className="cc-modal-doc-image"
                    onClick={() => setImageZoomed((z) => !z)}
                    title={
                      imageZoomed ? "Click to fit view" : "Click to zoom 100%"
                    }
                    style={{ cursor: imageZoomed ? "zoom-out" : "zoom-in" }}
                  />
                </div>
              </div>

              {/* Forensic Details Sidebar */}
              <div className="cc-modal-dossier-panel">
                <div className="cc-dossier-header">
                  <span className="cc-dossier-eyebrow">
                    FORENSIC AUDIT DOSSIER
                  </span>
                  <h3>Investigative Findings</h3>
                </div>

                <p className="cc-dossier-desc">{activeItem.description}</p>

                <div className="cc-dossier-metadata-table">
                  <h4>Exhibit Metadata & Technical Attributes</h4>
                  {activeItem.details.map((row, idx) => (
                    <div key={idx} className="cc-dossier-meta-row">
                      <span className="cc-meta-label">{row.label}</span>
                      <span className="cc-meta-value">{row.value}</span>
                    </div>
                  ))}
                  {/* If Exhibit 06 and server plate token available, surface token row cleanly */}
                  {activeItem.id === "exhibit-06" && serverPlateToken && (
                    <div className="cc-dossier-meta-row cc-dossier-meta-row--highlight">
                      <span className="cc-meta-label">Recovered Marker</span>
                      <span className="cc-meta-value cc-meta-token">
                        {serverPlateToken}
                      </span>
                    </div>
                  )}
                </div>

                <div className="cc-dossier-tip">
                  <strong>Investigator Cross-Reference:</strong>
                  <span>
                    {" "}
                    All document text is rendered crisply in vector format
                    above. Verify timestamps against the operational incident
                    timeline and witness testimony.
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer Navigation */}
            <div className="cc-forensic-modal-footer">
              <button
                type="button"
                className="product-btn product-btn--small product-btn--light"
                onClick={() => navigateItem("prev")}
              >
                ← Previous Exhibit
              </button>
              <span className="cc-modal-counter">
                Exhibit{" "}
                {FORENSIC_EVIDENCE_ITEMS.findIndex(
                  (it) => it.id === activeItem.id,
                ) + 1}{" "}
                of {FORENSIC_EVIDENCE_ITEMS.length}
              </span>
              <button
                type="button"
                className="product-btn product-btn--small product-btn--light"
                onClick={() => navigateItem("next")}
              >
                Next Exhibit →
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "20px",
          padding: "14px",
          background: "rgba(0, 200, 233, 0.05)",
          borderLeft: "3px solid var(--club)",
          fontSize: "13px",
          color: "#a3a3ad",
        }}
      >
        Tip for investigators: Read the forensic examiner's report on the
        displaced video stream (DFU-REP-2026-042) to discover the exact raw
        frame header marker.
      </div>
    </div>
  );
}

const VAULT_SIGNAL_ARTIFACTS = [
  {
    id: "PKT-801-A",
    name: "Frame Alpha // Ingress Header",
    channel: "CH-8 (PRIMARY BEACON)",
    isTargetStream: true,
    seqIndex: 1,
    epoch: "03:17:01.120 UTC",
    parity: "VERIFIED [ODD-ACK]",
    isParityValid: true,
    authHash: "VALID [HASH-8A1]",
    fragment: "UN",
    marker: "PRE-01 (INGRESS DELIMITER)",
    badgeClass: "cc-badge--beacon",
    status: "AUTHENTICATED",
    analystNotes:
      "Initial transmission burst originating from gateway border node. Frame contains unmasked prefix envelope.",
    hexDump:
      "45 00 00 3C 1C 46 40 00 40 06 72 3B 0A 0E 00 01 0A 0E 63 0C 55 4E 20 8A",
  },
  {
    id: "DECOY-301-E",
    name: "Echo Reflection // Tamper Loop",
    channel: "CH-3 (REPLAY ECHO)",
    isTargetStream: false,
    seqIndex: null,
    epoch: "03:14:18.040 UTC",
    parity: "FAILED [PARITY INVERTED]",
    isParityValid: false,
    authHash: "INVALID [REPLAY-MISMATCH]",
    fragment: "OR",
    marker: "ECHO-GHOST (LOOPBACK REFLECTION)",
    badgeClass: "cc-badge--echo",
    status: "REPLAY ECHO",
    analystNotes:
      "Reflected packet waveform recorded during the hardware tap installation on switch SW-4. Spurious reflection, not part of primary stream.",
    hexDump:
      "45 00 00 24 3A 12 00 00 38 06 1B 94 0A 0E 00 01 0A 0E 00 01 4F 52 00 00",
  },
  {
    id: "PKT-802-B",
    name: "Frame Beta // Core Carrier Burst",
    channel: "CH-8 (PRIMARY BEACON)",
    isTargetStream: true,
    seqIndex: 2,
    epoch: "03:17:03.450 UTC",
    parity: "VERIFIED [ODD-ACK]",
    isParityValid: true,
    authHash: "VALID [HASH-8A1]",
    fragment: "MA",
    marker: "MID-02 (CARRIER CONTINUITY)",
    badgeClass: "cc-badge--beacon",
    status: "AUTHENTICATED",
    analystNotes:
      "Secondary carrier envelope captured prior to isolation trigger. Verified hash parity matching primary broadcast.",
    hexDump:
      "45 00 00 40 2B 19 40 00 40 06 63 2E 0A 0E 00 01 0A 0E 63 0C 4D 41 9C 14",
  },
  {
    id: "NOISE-901-X",
    name: "Interference Spike // HVAC RF Glitch",
    channel: "CH-1 (NOISE INTERFERENCE)",
    isTargetStream: false,
    seqIndex: null,
    epoch: "03:16:40.220 UTC",
    parity: "CORRUPTED [CRC-ERR]",
    isParityValid: false,
    authHash: "NONE [UNAUTHENTICATED]",
    fragment: "XX",
    marker: "NOISE-BURST (ELECTROMAGNETIC JITTER)",
    badgeClass: "cc-badge--noise",
    status: "NOISE ARTIFACT",
    analystNotes:
      "Radio-frequency noise burst coinciding with basement HVAC compressor startup. Lacks authentication wrapper.",
    hexDump:
      "00 00 FF FF AA BB CC DD 00 11 22 33 44 55 66 77 58 58 EE FF 00 00 12 34",
  },
  {
    id: "PKT-803-C",
    name: "Frame Gamma // Payload Transition",
    channel: "CH-8 (PRIMARY BEACON)",
    isTargetStream: true,
    seqIndex: 3,
    epoch: "03:17:05.880 UTC",
    parity: "VERIFIED [ODD-ACK]",
    isParityValid: true,
    authHash: "VALID [HASH-8A1]",
    fragment: "SK",
    marker: "MID-03 (PAYLOAD TRANSITION)",
    badgeClass: "cc-badge--beacon",
    status: "AUTHENTICATED",
    analystNotes:
      "Tertiary beacon segment transferring internal telemetry across the encrypted socket.",
    hexDump:
      "45 00 00 3E 4D 82 40 00 40 06 41 09 0A 0E 00 01 0A 0E 63 0C 53 4B 8B 77",
  },
  {
    id: "PKT-804-D",
    name: "Frame Delta // Terminal Delimiter",
    channel: "CH-8 (PRIMARY BEACON)",
    isTargetStream: true,
    seqIndex: 4,
    epoch: "03:17:07.910 UTC",
    parity: "VERIFIED [ODD-ACK]",
    isParityValid: true,
    authHash: "VALID [HASH-8A1]",
    fragment: "ED",
    marker: "FIN-04 (TERMINAL DELIMITER)",
    badgeClass: "cc-badge--beacon",
    status: "AUTHENTICATED",
    analystNotes:
      "Final termination packet signaling teardown of the rogue bridge. Closes transmission sequence.",
    hexDump:
      "45 00 00 38 9F 04 40 00 40 06 1A 7C 0A 0E 00 01 0A 0E 63 0C 45 44 FF 00",
  },
];

function VaultSignalReconstruction({ data, onBack }) {
  const [slots, setSlots] = useState([null, null, null, null]);
  const [inspectingArtifact, setInspectingArtifact] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isSolved, setIsSolved] = useState(false);

  const isAssigned = (artifactId) =>
    slots.some((slot) => slot?.id === artifactId);

  const assignToSlot = (artifact, targetIndex = -1) => {
    setFeedback(null);
    setIsSolved(false);

    if (isAssigned(artifact.id)) {
      setSlots((prev) => prev.map((s) => (s?.id === artifact.id ? null : s)));
      return;
    }

    setSlots((prev) => {
      const next = [...prev];
      if (targetIndex >= 0 && targetIndex < 4) {
        next[targetIndex] = artifact;
        return next;
      }
      const emptyIdx = next.findIndex((s) => s === null);
      if (emptyIdx !== -1) {
        next[emptyIdx] = artifact;
      } else {
        setFeedback({
          type: "error",
          message:
            "All 4 sequence slots are full. Remove an artifact before adding another.",
        });
      }
      return next;
    });
  };

  const removeFromSlot = (slotIdx) => {
    setFeedback(null);
    setIsSolved(false);
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const handleReset = () => {
    setSlots([null, null, null, null]);
    setFeedback(null);
    setIsSolved(false);
  };

  const handleReconcile = () => {
    setFeedback(null);
    setIsSolved(false);

    const filledCount = slots.filter(Boolean).length;
    if (filledCount < 4) {
      setFeedback({
        type: "error",
        message: `Matrix Incomplete: 4 packet fragments required. Currently assigned: ${filledCount}/4.`,
      });
      return;
    }

    if (slots.some((s) => s.id === "DECOY-301-E")) {
      setFeedback({
        type: "error",
        message:
          "Reconciliation Aborted: Replay echo fragment (CH-3) detected in matrix. Filter out loopback reflections.",
      });
      return;
    }

    if (slots.some((s) => s.id === "NOISE-901-X")) {
      setFeedback({
        type: "error",
        message:
          "Reconciliation Aborted: Parity failure. Unauthenticated RF noise spike (CH-1) detected in matrix.",
      });
      return;
    }

    const isCorrectOrder =
      slots[0]?.id === "PKT-801-A" &&
      slots[1]?.id === "PKT-802-B" &&
      slots[2]?.id === "PKT-803-C" &&
      slots[3]?.id === "PKT-804-D";

    if (!isCorrectOrder) {
      setFeedback({
        type: "error",
        message:
          "Sequence Discontinuity: Packets are out of chronological order. Align the authentic CH-8 frames by ascending sequence index (Seq 1 → 4).",
      });
      return;
    }

    setIsSolved(true);
    setFeedback({
      type: "success",
      message:
        "Carrier Lock Established: All 4 authentic beacon frames synchronized successfully across Channel 8!",
    });
  };

  return (
    <div className="cc-vault-reconstruction-container">
      <div className="cc-vault-header-block">
        <p className="product-eyebrow">
          VAULT LEVEL 4 // FINAL TRANSMISSION CONTAINMENT
        </p>
        <h1>Core Signal Vault: Signal Reconstruction</h1>

        <div className="cc-vault-riddle-quote">
          <p>
            "The vault has kept the truth in fragments, not in a single hiding
            place. Some records are echoes, some are interruptions, and some
            belong to a different signal entirely. Restore the sequence that
            survived the disturbance. When the fragments agree, the word they
            protect will be yours to name."
          </p>
        </div>

        <p style={{ color: "#a3a3ad", lineHeight: "1.6", margin: "0 0 16px" }}>
          Signal analysis confirms the campus relay intrusion vector has been
          isolated. 6 residual packet fragments were intercepted in the vault
          buffer during channel containment. Examine the artifacts below, filter
          out spurious echoes and noise spikes, and reconcile the authentic
          carrier frames into the alignment matrix in chronological sequence.
        </p>
      </div>

      <div className="cc-vault-spec-banner">
        <div className="cc-vault-spec-item">
          <span className="cc-vault-spec-title">Target Carrier Stream</span>
          <span className="cc-vault-spec-value" style={{ color: "#38bdf8" }}>
            CH-8 (PRIMARY BEACON)
          </span>
        </div>
        <div className="cc-vault-spec-item">
          <span className="cc-vault-spec-title">Required Parity Check</span>
          <span className="cc-vault-spec-value" style={{ color: "#10b981" }}>
            ODD-ACK [PARITY OK]
          </span>
        </div>
        <div className="cc-vault-spec-item">
          <span className="cc-vault-spec-title">Carrier Checksum</span>
          <span className="cc-vault-spec-value" style={{ color: "#72efdd" }}>
            VALID [HASH-8A1]
          </span>
        </div>
        <div className="cc-vault-spec-item">
          <span className="cc-vault-spec-title">Exclusion Filters</span>
          <span className="cc-vault-spec-value" style={{ color: "#f87171" }}>
            DISCARD CH-3 (ECHO) & CH-1 (NOISE)
          </span>
        </div>
      </div>

      <div className="cc-vault-matrix-wrapper">
        <div className="cc-vault-matrix-header">
          <h3>Signal Alignment Matrix (4 Sequence Slots)</h3>
          <span
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontFamily: "var(--font-mono)",
            }}
          >
            Allocated: {slots.filter(Boolean).length} / 4
          </span>
        </div>

        <div className="cc-vault-slots-row">
          {slots.map((item, idx) => (
            <div
              key={idx}
              className={`cc-vault-slot-card ${item ? "filled" : ""}`}
            >
              <span className="cc-vault-slot-index">
                Slot {idx + 1} // Seq #{idx + 1}
              </span>
              {item ? (
                <>
                  <button
                    type="button"
                    className="cc-vault-slot-remove-btn"
                    onClick={() => removeFromSlot(idx)}
                    title="Remove from slot"
                  >
                    ✕
                  </button>
                  <span className="cc-vault-slot-filled-id">{item.id}</span>
                  <span className="cc-vault-slot-filled-frag">
                    {item.fragment}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: item.isTargetStream ? "#38bdf8" : "#f59e0b",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {item.channel}
                  </span>
                </>
              ) : (
                <span className="cc-vault-slot-empty-text">[ Empty Slot ]</span>
              )}
            </div>
          ))}
        </div>

        <div className="cc-vault-matrix-controls">
          <button
            type="button"
            className="product-btn product-btn--primary"
            onClick={handleReconcile}
          >
            Reconcile Signal Matrix
          </button>
          <button
            type="button"
            className="product-btn product-btn--small product-btn--light"
            onClick={handleReset}
          >
            Reset Alignment
          </button>
        </div>

        {feedback && (
          <div
            className={`cc-vault-feedback-box cc-vault-feedback-box--${feedback.type}`}
          >
            {feedback.message}
          </div>
        )}

        {isSolved && (
          <div className="cc-vault-reconstructed-output">
            <span
              style={{
                fontSize: "11px",
                color: "#10b981",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              ✓ Transmission Reconstructed Across Channel 8
            </span>
            <div className="cc-vault-reconstructed-token">UNMASKED</div>
            <p
              style={{
                margin: "8px 0 12px",
                fontSize: "13px",
                color: "#cbd5e1",
              }}
            >
              Enter this keyword into the{" "}
              <strong>Operation Shadow Beacon</strong> answer field on the
              investigation tab to authorize vault containment.
            </p>
            <CopyButton value="UNMASKED" />
          </div>
        )}
      </div>

      <div className="cc-vault-section-heading">
        <h3>Captured Signal Artifacts Buffer</h3>
        <span
          style={{
            fontSize: "12px",
            color: "#64748b",
            fontFamily: "var(--font-mono)",
          }}
        >
          Click an artifact to inspect or assign to matrix
        </span>
      </div>

      <div className="cc-vault-artifacts-grid">
        {VAULT_SIGNAL_ARTIFACTS.map((artifact) => {
          const inMatrix = isAssigned(artifact.id);
          return (
            <div
              key={artifact.id}
              className={`cc-vault-artifact-card ${inMatrix ? "selected-in-matrix" : ""}`}
            >
              <div className="cc-artifact-card-header">
                <div>
                  <span
                    className={`cc-artifact-id-badge ${artifact.badgeClass}`}
                  >
                    {artifact.id}
                  </span>
                  <h4
                    className="cc-artifact-title"
                    style={{ marginTop: "6px" }}
                  >
                    {artifact.name}
                  </h4>
                </div>
                {inMatrix && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#00c8e9",
                      fontFamily: "var(--font-mono)",
                      fontWeight: "bold",
                    }}
                  >
                    [ IN MATRIX ]
                  </span>
                )}
              </div>

              <div className="cc-artifact-meta-list">
                <div className="cc-artifact-meta-row">
                  <span className="cc-meta-k">Stream Channel:</span>
                  <span className="cc-meta-v">{artifact.channel}</span>
                </div>
                <div className="cc-artifact-meta-row">
                  <span className="cc-meta-k">Captured Epoch:</span>
                  <span className="cc-meta-v">{artifact.epoch}</span>
                </div>
                <div className="cc-artifact-meta-row">
                  <span className="cc-meta-k">Parity Check:</span>
                  <span
                    className={`cc-meta-v ${artifact.isParityValid ? "cc-meta-v--valid" : "cc-meta-v--invalid"}`}
                  >
                    {artifact.parity}
                  </span>
                </div>
                <div className="cc-artifact-meta-row">
                  <span className="cc-meta-k">Carrier Auth:</span>
                  <span className="cc-meta-v">{artifact.authHash}</span>
                </div>
              </div>

              <div className="cc-artifact-payload-box">
                <span className="cc-artifact-frag-label">Payload Fragment</span>
                <span className="cc-artifact-frag-val">
                  "{artifact.fragment}"
                </span>
              </div>

              <div className="cc-artifact-actions">
                <button
                  type="button"
                  className="product-btn product-btn--small product-btn--light"
                  onClick={() => setInspectingArtifact(artifact)}
                >
                  Inspect Packet
                </button>
                <button
                  type="button"
                  className={`product-btn product-btn--small ${inMatrix ? "product-btn--danger" : "product-btn--primary"}`}
                  onClick={() => assignToSlot(artifact)}
                >
                  {inMatrix ? "Remove from Matrix" : "Assign to Matrix"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {inspectingArtifact && (
        <div
          className="cc-vault-modal-overlay"
          onClick={() => setInspectingArtifact(null)}
        >
          <div
            className="cc-vault-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <div>
                <span
                  className={`cc-artifact-id-badge ${inspectingArtifact.badgeClass}`}
                >
                  {inspectingArtifact.id}
                </span>
                <h2
                  style={{
                    fontSize: "18px",
                    color: "#fff",
                    margin: "8px 0 2px",
                  }}
                >
                  {inspectingArtifact.name}
                </h2>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#72efdd",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {inspectingArtifact.marker}
                </span>
              </div>
              <button
                type="button"
                className="cc-modal-close-btn"
                onClick={() => setInspectingArtifact(null)}
                aria-label="Close packet inspection"
              >
                ✕ Close
              </button>
            </div>

            <div
              className="cc-artifact-meta-list"
              style={{ marginBottom: "16px" }}
            >
              <div className="cc-artifact-meta-row">
                <span className="cc-meta-k">Carrier Channel:</span>
                <span className="cc-meta-v">{inspectingArtifact.channel}</span>
              </div>
              <div className="cc-artifact-meta-row">
                <span className="cc-meta-k">Capture Timestamp:</span>
                <span className="cc-meta-v">{inspectingArtifact.epoch}</span>
              </div>
              <div className="cc-artifact-meta-row">
                <span className="cc-meta-k">Parity Check:</span>
                <span
                  className={`cc-meta-v ${inspectingArtifact.isParityValid ? "cc-meta-v--valid" : "cc-meta-v--invalid"}`}
                >
                  {inspectingArtifact.parity}
                </span>
              </div>
              <div className="cc-artifact-meta-row">
                <span className="cc-meta-k">Carrier Authentication Hash:</span>
                <span className="cc-meta-v">{inspectingArtifact.authHash}</span>
              </div>
              <div className="cc-artifact-meta-row">
                <span className="cc-meta-k">Sequence Order Index:</span>
                <span className="cc-meta-v">
                  {inspectingArtifact.seqIndex
                    ? `Seq #${inspectingArtifact.seqIndex} of 4`
                    : "UNORDERED (Decoy/Echo)"}
                </span>
              </div>
            </div>

            <p
              style={{
                fontSize: "12px",
                color: "#64748b",
                margin: "0 0 6px",
                textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
              }}
            >
              Raw Frame Buffer Hex Dump
            </p>
            <div className="cc-vault-hex-screen">
              {inspectingArtifact.hexDump}
            </div>

            <p
              style={{
                fontSize: "12px",
                color: "#64748b",
                margin: "14px 0 6px",
                textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
              }}
            >
              Forensic Analyst Assessment
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "#94a3b8",
                lineHeight: "1.6",
                background: "rgba(255,255,255,0.03)",
                padding: "12px",
                borderRadius: "4px",
                borderLeft: "3px solid #72efdd",
              }}
            >
              {inspectingArtifact.analystNotes}
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "20px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="product-btn product-btn--small product-btn--light"
                onClick={() => setInspectingArtifact(null)}
              >
                Close
              </button>
              <button
                type="button"
                className={`product-btn product-btn--small ${isAssigned(inspectingArtifact.id) ? "product-btn--danger" : "product-btn--primary"}`}
                onClick={() => {
                  assignToSlot(inspectingArtifact);
                  setInspectingArtifact(null);
                }}
              >
                {isAssigned(inspectingArtifact.id)
                  ? "Remove from Matrix"
                  : "Assign to Matrix"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const AdvisoryEvidenceBoard = ForensicEvidenceDesk;

function InvestigationResourcePage({ path, onBack }) {
  const slug = path.replace("/investigation/resources/", "").replace(/\/$/, "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const fetchResource = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await apiRequest(
          `/api/rounds/2/investigation/resources/${slug}`,
        );
        if (!active) return;
        setData(res);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Unable to access investigation resource.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchResource();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) return <LoadingState label="Decrypting investigation asset…" />;

  if (error || !data) {
    return (
      <div className="mock-resource-shell">
        <header className="mock-resource-nav">
          <span className="mock-resource-brand">
            CAMPUS SEC-OPS // ACCESS GATEWAY
          </span>
          <button
            className="product-btn product-btn--small product-btn--light"
            onClick={onBack}
          >
            Return to Dashboard
          </button>
        </header>
        <div
          className="mock-resource-container"
          style={{ textAlign: "center", marginTop: "60px" }}
        >
          <p className="product-eyebrow">403 // CLASSIFIED ASSET</p>
          <h1>Access Restricted</h1>
          <p
            style={{
              color: "#ff6d6d",
              maxWidth: "540px",
              margin: "16px auto",
              lineHeight: "1.6",
            }}
          >
            {error ||
              "This resource is locked. You must verify prior leads in Operation Shadow Beacon before this asset can be decrypted."}
          </p>
          <button className="product-btn product-btn--primary" onClick={onBack}>
            Return to Investigation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mock-resource-shell">
      <header className="mock-resource-nav">
        <span className="mock-resource-brand">{data.brand}</span>
        <button
          className="product-btn product-btn--small product-btn--light"
          onClick={onBack}
        >
          Return to Dashboard
        </button>
      </header>
      {slug === "advisory" ? (
        <AdvisoryEvidenceBoard data={data} />
      ) : slug === "vault" ? (
        <VaultSignalReconstruction data={data} onBack={onBack} />
      ) : (
        <div
          className="mock-resource-container"
          dangerouslySetInnerHTML={{ __html: data.html }}
        />
      )}
    </div>
  );
}

function LoadingState({ label }) {
  return (
    <main className="product-page">
      <div className="product-panel state-panel">
        <p className="product-eyebrow">PLEASE WAIT</p>
        <h1>{label}</h1>
      </div>
    </main>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <main className="product-page">
      <div className="product-panel state-panel">
        <p className="product-eyebrow">REQUEST FAILED</p>
        <h1>Could not load this view.</h1>
        <FormMessage error={message} />
        <button className="product-btn product-btn--primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </main>
  );
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button className="product-btn product-btn--small" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const LOCAL_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateLocalRandomPassword(length = 12) {
  let result = '';
  const cryptoObj = window.crypto || window.msCrypto;
  const values = new Uint32Array(length);
  cryptoObj.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += LOCAL_PASSWORD_ALPHABET[values[i] % LOCAL_PASSWORD_ALPHABET.length];
  }
  return result;
}

function CredentialBox({ credentials }) {
  if (!credentials) return null;
  return (
    <div className="credential-box">
      <strong>Team credentials</strong>
      <p>{credentials.password ? 'Save the password now. It will not be displayed again.' : 'Custom password was set by administrator.'}</p>
      <div><span>Team ID <code>{credentials.teamId}</code></span><CopyButton value={credentials.teamId} /></div>
      {credentials.password && <div><span>Password <code>{credentials.password}</code></span><CopyButton value={credentials.password} /></div>}
    </div>
  );
}

function ResetPasswordModal({ team, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGenerate = () => {
    setPassword(generateLocalRandomPassword(12));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const body = {};
      if (password && password.trim().length > 0) {
        body.password = password;
      }
      const result = await apiRequest(`/api/admin/teams/${team.teamId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setPassword('');
      onSuccess(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal cc-prog-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <button className="close" onClick={onClose} aria-label="Close dialog">×</button>
        <p className="eyebrow">ACCESS CONTROL / CREDENTIAL RESET</p>
        <h2>Reset password</h2>
        <p style={{ margin: '8px 0 16px', color: '#c8c8d0', fontSize: '13px', lineHeight: 1.5 }}>
          Resetting the password for <strong>{team.name}</strong> (<code>{team.teamId}</code>) will immediately invalidate all active team sessions and clear login lockouts.
        </p>

        {error && <p className="product-message is-error" role="alert" style={{ marginBottom: '14px' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <Field label="NEW PASSWORD (OPTIONAL)">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="product-input"
                value={password}
                placeholder="Leave blank to generate on server"
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="product-btn product-btn--small product-btn--light"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                className="product-btn product-btn--small product-btn--light"
                onClick={handleGenerate}
              >
                Generate random
              </button>
            </div>
          </Field>
          <p style={{ fontSize: '12px', color: '#8e8e99', margin: '4px 0 18px', lineHeight: 1.4 }}>
            10–128 characters, no leading/trailing spaces, cannot contain team ID/name, no single repeated character or obvious sequences. Leave empty to generate automatically on server.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="product-btn product-btn--light" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="product-btn product-btn--primary" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}


function ManageProgressModal({ team, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState({ error: "", success: "" });

  const [advanceRound, setAdvanceRound] = useState(2);
  const [waivePrior, setWaivePrior] = useState(true);
  const [advanceReason, setAdvanceReason] = useState("");
  const [confirmAdvance, setConfirmAdvance] = useState(false);

  const [waiveRoundNum, setWaiveRoundNum] = useState(1);
  const [waiveStatus, setWaiveStatus] = useState("waived");
  const [waiveReason, setWaiveReason] = useState("");
  const [confirmWaive, setConfirmWaive] = useState(false);

  const [revertReason, setRevertReason] = useState("");
  const [confirmDisruptive, setConfirmDisruptive] = useState(false);
  const [revertWarning, setRevertWarning] = useState(null);

  const fetchProgression = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest(
        `/api/admin/teams/${team.teamId}/progression`,
      );
      setData(res);
    } catch (err) {
      setMessage({ error: err.message, success: "" });
    } finally {
      setLoading(false);
    }
  }, [team.teamId]);

  useEffect(() => {
    void fetchProgression();
  }, [fetchProgression]);

  const handleAdvance = async (e) => {
    e.preventDefault();
    setMessage({ error: "", success: "" });
    if (!advanceReason.trim() || advanceReason.trim().length < 3) {
      setMessage({
        error:
          "A valid reason (at least 3 characters) is required to advance progression.",
        success: "",
      });
      return;
    }
    if (!confirmAdvance) {
      setMessage({
        error: "Please check the confirmation box before granting progression.",
        success: "",
      });
      return;
    }
    setLoading(true);
    try {
      await apiRequest(`/api/admin/teams/${team.teamId}/progression/advance`, {
        method: "POST",
        body: JSON.stringify({
          targetRound: Number(advanceRound),
          waivePrior,
          reason: advanceReason.trim(),
        }),
      });
      setMessage({
        error: "",
        success: `Progression advanced to Round ${advanceRound} successfully.`,
      });
      setAdvanceReason("");
      setConfirmAdvance(false);
      await fetchProgression();
      if (onRefresh) onRefresh();
    } catch (err) {
      setMessage({ error: err.message, success: "" });
    } finally {
      setLoading(false);
    }
  };

  const handleWaive = async (e) => {
    e.preventDefault();
    setMessage({ error: "", success: "" });
    if (!waiveReason.trim() || waiveReason.trim().length < 3) {
      setMessage({
        error:
          "A valid reason (at least 3 characters) is required to update round status.",
        success: "",
      });
      return;
    }
    if (!confirmWaive) {
      setMessage({
        error:
          "Please check the confirmation box before updating round requirement.",
        success: "",
      });
      return;
    }
    setLoading(true);
    try {
      await apiRequest(`/api/admin/teams/${team.teamId}/progression/waive`, {
        method: "POST",
        body: JSON.stringify({
          round: Number(waiveRoundNum),
          status: waiveStatus,
          reason: waiveReason.trim(),
        }),
      });
      setMessage({
        error: "",
        success: `Round ${waiveRoundNum} requirement updated to '${waiveStatus}'.`,
      });
      setWaiveReason("");
      setConfirmWaive(false);
      await fetchProgression();
      if (onRefresh) onRefresh();
    } catch (err) {
      setMessage({ error: err.message, success: "" });
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (e) => {
    e.preventDefault();
    setMessage({ error: "", success: "" });
    if (!revertReason.trim() || revertReason.trim().length < 3) {
      setMessage({
        error:
          "A valid reason (at least 3 characters) is required to revoke progression overrides.",
        success: "",
      });
      return;
    }
    if (!confirmDisruptive) {
      setMessage({
        error:
          "Please check the confirmation box acknowledging revocation before proceeding.",
        success: "",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest(
        `/api/admin/teams/${team.teamId}/progression/revert`,
        {
          method: "POST",
          body: JSON.stringify({
            confirmDisruptive,
            reason: revertReason.trim(),
          }),
        },
      );
      if (res.warning && res.requiresConfirmation) {
        setRevertWarning(res.message);
        setMessage({ error: res.message, success: "" });
      } else {
        setRevertWarning(null);
        setConfirmDisruptive(false);
        setRevertReason("");
        setMessage({
          error: "",
          success:
            "Progression overrides revoked successfully. Historical gameplay and scores remain intact.",
        });
        await fetchProgression();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      setMessage({ error: err.message, success: "" });
    } finally {
      setLoading(false);
    }
  };

  const progression = data?.progression;
  const sessions = data?.sessions || [];
  const globalRounds = data?.globalRounds || [];

  return (
    <div
      className="cc-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="progression-modal-title"
    >
      <div
        className="cc-modal cc-progression-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cc-modal__header">
          <div>
            <p className="product-eyebrow">
              ADMINISTRATIVE OVERRIDE // TEAM PROGRESSION
            </p>
            <h2 id="progression-modal-title">
              {team.name} <span className="product-mono">({team.teamId})</span>
            </h2>
          </div>
          <button
            className="cc-modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="cc-prog-summary-bar">
          <div className="cc-prog-summary-item">
            <span className="cc-prog-summary-label">EFFECTIVE ELIGIBILITY</span>
            <strong className="cc-prog-summary-val cc-prog-summary-val--highlight">
              Round {progression?.effectiveEligibleRound || 1}
            </strong>
          </div>
          <div className="cc-prog-summary-item">
            <span className="cc-prog-summary-label">INITIAL PROGRESSION</span>
            <strong className="cc-prog-summary-val">
              Round {progression?.initialRound || 1}
            </strong>
          </div>
          <div className="cc-prog-summary-item">
            <span className="cc-prog-summary-label">WAIVED ROUNDS</span>
            <strong className="cc-prog-summary-val">
              {progression?.waivedRounds?.length
                ? progression.waivedRounds.map((r) => `R${r}`).join(", ")
                : "None"}
            </strong>
          </div>
          <div className="cc-prog-summary-item">
            <span className="cc-prog-summary-label">TOTAL OVERRIDES</span>
            <strong className="cc-prog-summary-val">
              {progression?.overrides?.length || 0}
            </strong>
          </div>
        </div>

        <nav className="cc-prog-tabs" role="tablist">
          <button
            className={`cc-prog-tab ${tab === "overview" ? "is-active" : ""}`}
            onClick={() => setTab("overview")}
            type="button"
          >
            Overview & Status
          </button>
          <button
            className={`cc-prog-tab ${tab === "advance" ? "is-active" : ""}`}
            onClick={() => setTab("advance")}
            type="button"
          >
            Advance Team
          </button>
          <button
            className={`cc-prog-tab ${tab === "waive" ? "is-active" : ""}`}
            onClick={() => setTab("waive")}
            type="button"
          >
            Waive / Status
          </button>
          <button
            className={`cc-prog-tab ${tab === "revert" ? "is-active" : ""}`}
            onClick={() => setTab("revert")}
            type="button"
          >
            Revoke Override
          </button>
          <button
            className={`cc-prog-tab ${tab === "audit" ? "is-active" : ""}`}
            onClick={() => setTab("audit")}
            type="button"
          >
            Audit History ({progression?.overrides?.length || 0})
          </button>
        </nav>

        {message.error && (
          <div className="cc-prog-alert cc-prog-alert--error">
            {message.error}
          </div>
        )}
        {message.success && (
          <div className="cc-prog-alert cc-prog-alert--success">
            {message.success}
          </div>
        )}

        <div className="cc-prog-modal-body">
          {loading && !data && (
            <div className="cc-prog-loading">Loading progression data…</div>
          )}

          {data && tab === "overview" && (
            <div className="cc-prog-pane">
              <h3 className="cc-prog-pane-title">
                Per-Round Progression Status
              </h3>
              <p className="cc-prog-pane-desc">
                Review prerequisite fulfillment, global round states, and
                whether rounds were played normally or granted administrative
                waiver.
              </p>

              <div className="cc-prog-rounds-grid">
                {ROUND_NUMBERS.map((rNum) => {
                  const rStatus = progression?.rounds?.[rNum];
                  const gRound = globalRounds.find((gr) => gr.round === rNum);
                  const isEligible =
                    (progression?.effectiveEligibleRound || 1) >= rNum;
                  return (
                    <div
                      key={rNum}
                      className={`cc-prog-round-card cc-prog-round-card--${rStatus?.status || "pending"}`}
                    >
                      <div className="cc-prog-round-card__header">
                        <span className="product-mono">ROUND 0{rNum}</span>
                        <span
                          className={`cc-round-status cc-round-status--${gRound?.status || "not_started"}`}
                        >
                          GLOBAL:{" "}
                          {(gRound?.status || "not started").replaceAll(
                            "_",
                            " ",
                          )}
                        </span>
                      </div>
                      <div className="cc-prog-round-card__badge-row">
                        <span
                          className={`cc-prog-pill cc-prog-pill--${rStatus?.status || "completed_normally" ? (rStatus.status === "completed_normally" ? "completed_normally" : rStatus.status) : "pending"}`}
                        >
                          {rStatus?.status === "completed_normally" &&
                            "Completed Normally"}
                          {rStatus?.status === "waived" &&
                            "Administratively Waived"}
                          {(!rStatus || rStatus.status === "pending") &&
                            "Pending"}
                        </span>
                        <span
                          className={`cc-prog-pill ${isEligible ? "cc-prog-pill--eligible" : "cc-prog-pill--ineligible"}`}
                        >
                          {isEligible ? "Eligible" : "Prereq Missing"}
                        </span>
                      </div>
                      <dl className="cc-prog-round-card__dl">
                        <div>
                          <dt>Score Recorded</dt>
                          <dd>
                            {rStatus?.score !== null &&
                            rStatus?.score !== undefined
                              ? `${rStatus.score} pts`
                              : "None"}
                          </dd>
                        </div>
                        <div>
                          <dt>Game Completed</dt>
                          <dd>{rStatus?.game || "—"}</dd>
                        </div>
                        <div>
                          <dt>Access Preconditions</dt>
                          <dd>
                            {isEligible
                              ? gRound?.status === "running"
                                ? "Playable Now"
                                : "Requires Round Start"
                              : `Must complete or waive R${rNum - 1}`}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>

              <h3 className="cc-prog-pane-title" style={{ marginTop: "24px" }}>
                Recorded Gameplay Sessions
              </h3>
              {sessions.length === 0 ? (
                <p className="cc-prog-empty-note">
                  No game sessions recorded for this team yet.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="product-table cc-prog-subtable">
                    <thead>
                      <tr>
                        <th>Round</th>
                        <th>Game</th>
                        <th>Status</th>
                        <th>Started At</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s._id}>
                          <td className="product-mono">Round {s.round}</td>
                          <td>{s.game}</td>
                          <td>
                            <span
                              className={`cc-prog-pill cc-prog-pill--${s.status}`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td>{new Date(s.startedAt).toLocaleString()}</td>
                          <td>
                            {s.status === "submitted"
                              ? "Legitimate Completion"
                              : "In Progress"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {data && tab === "advance" && (
            <form
              className="cc-prog-pane cc-prog-form"
              onSubmit={handleAdvance}
            >
              <h3 className="cc-prog-pane-title">
                Action A: Advance Team to Target Round
              </h3>
              <p className="cc-prog-pane-desc">
                Select a target round to administratively unlock progression
                past earlier prerequisites. Choosing to waive prior rounds
                ensures preceding uncompleted rounds are recorded as waived
                without fabricating game scores.
              </p>

              <div className="cc-prog-form-group">
                <label className="cc-prog-label">
                  TARGET ROUND ELIGIBILITY
                </label>
                <select
                  className="product-input"
                  value={advanceRound}
                  onChange={(e) => setAdvanceRound(Number(e.target.value))}
                >
                  <option value={2}>
                    Round 2 — Web UI Hijacking (Operation Shadow Beacon)
                  </option>
                  <option value={3}>
                    Round 3 — Digital Detective (Cyber Incident Investigation)
                  </option>
                </select>
              </div>

              <div className="cc-prog-form-group">
                <label className="cc-prog-checkbox-label">
                  <input
                    type="checkbox"
                    checked={waivePrior}
                    onChange={(e) => setWaivePrior(e.target.checked)}
                  />
                  <span>
                    Waive uncompleted prior rounds (records administrative
                    waiver without awarding fake points)
                  </span>
                </label>
              </div>

              <div className="cc-prog-form-group">
                <label className="cc-prog-label">
                  ADMINISTRATIVE REASON (REQUIRED)
                </label>
                <textarea
                  className="product-input cc-prog-textarea"
                  placeholder="e.g. Technical disconnect during Round 1 Circuit Sync, authorized progression exception"
                  required
                  rows={3}
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                />
              </div>

              <div className="cc-prog-form-group">
                <label className="cc-prog-checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirmAdvance}
                    onChange={(e) => setConfirmAdvance(e.target.checked)}
                  />
                  <span>
                    I confirm granting Round {advanceRound} progression
                    eligibility exception to {team.teamId}.
                  </span>
                </label>
              </div>

              <div className="cc-prog-notice">
                <strong>IMPORTANT:</strong> This progression override changes
                ONLY this team’s eligibility. It does not globally start, pause,
                or end rounds, and does not alter any other team.
              </div>

              <button
                className="product-btn product-btn--primary"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Applying Override…"
                  : `Grant Eligibility to Round ${advanceRound}`}
              </button>
            </form>
          )}

          {data && tab === "waive" && (
            <form className="cc-prog-pane cc-prog-form" onSubmit={handleWaive}>
              <h3 className="cc-prog-pane-title">
                Action B: Configure Individual Round Requirement
              </h3>
              <p className="cc-prog-pane-desc">
                Explicitly mark a specific round prerequisite as waived,
                pending, or completed normally.
              </p>

              <div className="cc-prog-form-group">
                <label className="cc-prog-label">SELECT ROUND</label>
                <select
                  className="product-input"
                  value={waiveRoundNum}
                  onChange={(e) => setWaiveRoundNum(Number(e.target.value))}
                >
                  <option value={1}>Round 1 — Mini Games</option>
                  <option value={2}>Round 2 — Web UI Hijacking</option>
                  <option value={3}>Round 3 — Digital Detective</option>
                </select>
              </div>

              <div className="cc-prog-form-group">
                <label className="cc-prog-label">TARGET STATUS</label>
                <select
                  className="product-input"
                  value={waiveStatus}
                  onChange={(e) => setWaiveStatus(e.target.value)}
                >
                  <option value="waived">
                    Administratively Waived (exception granted, 0 points)
                  </option>
                  <option value="pending">
                    Pending (prerequisite required, no waiver)
                  </option>
                  <option value="completed_normally">
                    Completed Normally (verifies existing gameplay
                    session/score)
                  </option>
                </select>
              </div>

              <div className="cc-prog-form-group">
                <label className="cc-prog-label">MANDATORY REASON</label>
                <textarea
                  className="product-input cc-prog-textarea"
                  placeholder="Specify official rationale for this round status change"
                  required
                  rows={3}
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                />
              </div>

              <div className="cc-prog-form-group">
                <label className="cc-prog-checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirmWaive}
                    onChange={(e) => setConfirmWaive(e.target.checked)}
                  />
                  <span>
                    I confirm setting Round {waiveRoundNum} requirement to '
                    {waiveStatus}' for {team.teamId}.
                  </span>
                </label>
              </div>

              <button
                className="product-btn product-btn--primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Updating…" : "Update Round Status"}
              </button>
            </form>
          )}

          {data && tab === "revert" && (
            <form className="cc-prog-pane cc-prog-form" onSubmit={handleRevert}>
              <h3 className="cc-prog-pane-title">
                Action D: Revoke Progression Override
              </h3>
              <p className="cc-prog-pane-desc">
                Revoking an override removes administrative waivers and resets
                maximum eligibility to natural completion status. Legitimately
                earned scores, game sessions, and submitted flags are{" "}
                <strong>NEVER deleted</strong>.
              </p>

              {revertWarning && (
                <div className="cc-prog-alert cc-prog-alert--warning">
                  <strong>DISRUPTIVE ACTION WARNING:</strong>
                  <p>{revertWarning}</p>
                </div>
              )}

              <div className="cc-prog-form-group">
                <label className="cc-prog-checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirmDisruptive}
                    onChange={(e) => setConfirmDisruptive(e.target.checked)}
                  />
                  <span>
                    I acknowledge that future round access will be revoked for
                    this team if earlier rounds are incomplete.
                  </span>
                </label>
              </div>

              <div className="cc-prog-form-group">
                <label className="cc-prog-label">
                  REASON FOR REVOCATION (REQUIRED)
                </label>
                <textarea
                  className="product-input cc-prog-textarea"
                  placeholder="Document reason for reverting administrative progression override"
                  required
                  rows={3}
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                />
              </div>

              <button
                className="product-btn product-btn--light cc-prog-btn-danger"
                type="submit"
                disabled={loading}
              >
                {loading ? "Revoking…" : "Revoke Progression Overrides"}
              </button>
            </form>
          )}

          {data && tab === "audit" && (
            <div className="cc-prog-pane">
              <h3 className="cc-prog-pane-title">Progression Audit Trail</h3>
              <p className="cc-prog-pane-desc">
                Every administrative progression action is logged with acting
                administrator, timestamp, reason, and round impact.
              </p>

              {!progression?.overrides || progression.overrides.length === 0 ? (
                <p className="cc-prog-empty-note">
                  No administrative overrides have been applied to this team.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="product-table cc-prog-subtable">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Target Round</th>
                        <th>Waived Rounds</th>
                        <th>Admin ID</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progression.overrides.map((ov, i) => (
                        <tr key={ov.id || i}>
                          <td>{new Date(ov.createdAt).toLocaleString()}</td>
                          <td>
                            <span className="product-mono">{ov.action}</span>
                          </td>
                          <td>Round {ov.targetRound}</td>
                          <td>
                            {ov.waivedRounds?.length
                              ? ov.waivedRounds.map((r) => `R${r}`).join(", ")
                              : "—"}
                          </td>
                          <td>{ov.adminId}</td>
                          <td>{ov.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ onLogout }) {
  const [teams, setTeams] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [scores, setScores] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({
    name: "",
    password: "",
    biasPoints: 0,
    initialProgression: 1,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [editErrors, setEditErrors] = useState({});
  const [resetModalTeam, setResetModalTeam] = useState(null);
  const [manageProgressTeam, setManageProgressTeam] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [edits, setEdits] = useState({});
  const clockNow = useVisibleClock();
  const [updatedAt, setUpdatedAt] = useState(null);
  const [state, setState] = useState({ loading: true, error: "", success: "" });

  const load = async ({ includeLogs = false } = {}) => {
    try {
      const [teamData, roundData, scoreData, logData] = await Promise.all([
        apiRequest("/api/admin/teams"),
        apiRequest("/api/admin/rounds"),
        apiRequest("/api/admin/scores"),
        includeLogs ? apiRequest("/api/admin/logs") : Promise.resolve(null),
      ]);
      setTeams(teamData);
      setRounds(roundData);
      setScores(scoreData);
      if (logData) setLogs(logData);
      setUpdatedAt(Date.now());
      setState((current) => ({ ...current, loading: false, error: "" }));
    } catch (error) {
      if (
        error.message === "Admin access required" ||
        error.message === "Authentication required"
      )
        onLogout();
      else
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
    }
  };

  useEffect(() => {
    let refresh;
    const pollWhileVisible = () => {
      window.clearInterval(refresh);
      refresh = undefined;
      if (document.visibilityState === "visible") {
        void load({ includeLogs: true });
        refresh = window.setInterval(
          () => void load({ includeLogs: true }),
          10_000,
        );
      }
    };
    document.addEventListener("visibilitychange", pollWhileVisible);
    pollWhileVisible();
    return () => {
      window.clearInterval(refresh);
      document.removeEventListener("visibilitychange", pollWhileVisible);
    };
  }, []);

  useEffect(() => {
    const socket = getSocketConnection();
    socket.on("round:update", () => {
      void load({ includeLogs: false });
    });
    return () => {
      socket.disconnect();
    };
  }, [load]);

  const runAction = async (action, success) => {
    try {
      await action();
      setState({ loading: false, error: "", success });
      await load();
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message,
        success: "",
      }));
    }
  };

  const changeRound = (round, action, body = {}) =>
    runAction(
      () =>
        apiRequest(`/api/admin/rounds/${round}/${action}`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      `Round ${round} ${{ start: "started", pause: "paused", resume: "resumed", end: "ended", extend: "extended" }[action]}.`,
    );

  const startRound = (roundNumber, previousDurationSec, isRestart) => {
    const meta = ROUND_METADATA[roundNumber];
    const rawDuration = window.prompt(
      "Round duration in seconds (1–86400):",
      String(
        previousDurationSec ||
          meta?.defaultDurationSec ||
          (roundNumber === 2 ? 2700 : 1800),
      ),
    );
    if (rawDuration === null) return;
    const durationSec = Number(rawDuration);
    if (
      !Number.isInteger(durationSec) ||
      durationSec < 1 ||
      durationSec > 86400
    ) {
      setState((current) => ({
        ...current,
        error: "Duration must be a whole number from 1 to 86400 seconds.",
        success: "",
      }));
      return;
    }
    const confirmation = isRestart
      ? `Restart round ${roundNumber} for ${durationSec} seconds as a new attempt? Previous results are retained and continue to count toward team totals.`
      : `Start round ${roundNumber} for ${durationSec} seconds?`;
    if (!window.confirm(confirmation)) return;
    void changeRound(roundNumber, "start", { durationSec });
  };

  const extendRound = (roundNumber) => {
    const rawDuration = window.prompt(
      `Additional time to add to Round ${roundNumber} (in seconds, or e.g. 5m / 300s):`,
      "300",
    );
    if (rawDuration === null) return;
    const trimmed = rawDuration.trim().toLowerCase();
    let extendSec = 0;
    if (trimmed.endsWith("m")) {
      extendSec = Math.round(Number(trimmed.slice(0, -1)) * 60);
    } else if (trimmed.endsWith("s")) {
      extendSec = Math.round(Number(trimmed.slice(0, -1)));
    } else {
      extendSec = Math.round(Number(trimmed));
    }

    if (!Number.isInteger(extendSec) || extendSec < 1 || extendSec > 86400) {
      setState((current) => ({
        ...current,
        error: "Extension duration must be a whole number between 1 and 86400 seconds (e.g. 300 or 5m).",
        success: "",
      }));
      return;
    }

    const minFormatted = (extendSec / 60).toFixed(extendSec % 60 === 0 ? 0 : 1);
    const confirmation = `Extend round ${roundNumber} by ${extendSec} seconds (${minFormatted} min)?`;
    if (!window.confirm(confirmation)) return;
    void changeRound(roundNumber, "extend", { extendSec });
  };

  const adjustScore = (team) => {
    const round = window.prompt(
      `Round number for ${team.teamId} (1 to ${TOTAL_ROUNDS}):`,
    );
    if (round === null) return;
    const amount = window.prompt("Adjustment amount (-1000 to 1000):");
    if (amount === null) return;
    const reason = window.prompt("Reason (required, max 200 characters):");
    if (reason === null) return;
    const adjustment = {
      round: Number(round),
      amount: Number(amount),
      reason: reason.trim(),
    };
    if (
      !Number.isInteger(adjustment.round) ||
      adjustment.round < 1 ||
      adjustment.round > TOTAL_ROUNDS ||
      !Number.isInteger(adjustment.amount) ||
      adjustment.amount < -1000 ||
      adjustment.amount > 1000 ||
      !adjustment.reason ||
      adjustment.reason.length > 200
    ) {
      setState((current) => ({
        ...current,
        error: `Enter a valid round (1–${TOTAL_ROUNDS}), adjustment amount, and reason.`,
        success: "",
      }));
      return;
    }
    if (
      !window.confirm(
        `Apply ${adjustment.amount} points to ${team.teamId} in round ${adjustment.round}?\nReason: ${adjustment.reason}`,
      )
    )
      return;
    void runAction(
      () =>
        apiRequest(`/api/admin/teams/${team.teamId}/adjust`, {
          method: "POST",
          body: JSON.stringify(adjustment),
        }),
      `Score adjustment recorded for ${team.teamId}.`,
    );
  };

  const clearLockout = (teamId) => {
    if (!window.confirm(`Clear login lockout for ${teamId}?`)) return;
    void runAction(
      () =>
        apiRequest(`/api/admin/teams/${teamId}/clear-login-lockout`, {
          method: "POST",
          body: JSON.stringify({}),
        }),
      `Login lockout cleared for ${teamId}.`,
    );
  };

  const createTeam = async (event) => {
    event.preventDefault();
    setFormError("");
    setState({ loading: false, error: "", success: "" });
    try {
      const payload = {
        name: form.name,
        biasPoints: Number(form.biasPoints),
        initialProgression: Number(form.initialProgression || 1),
      };
      if (form.password && form.password.trim().length > 0) {
        payload.password = form.password;
      }
      const result = await apiRequest("/api/admin/teams", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.password) {
        setCredentials({ teamId: result.team.teamId, password: result.password });
      } else {
        setCredentials({ teamId: result.team.teamId });
      }
      setForm({ name: "", password: "", biasPoints: 0, initialProgression: 1 });
      setState({
        loading: false,
        error: "",
        success: `${result.team.teamId} created successfully.`,
      });
      await load();
    } catch (error) {
      setFormError(error.message);
      setState({ loading: false, error: error.message, success: "" });
    }
  };

  const updateTeam = async (teamId, patch) => {
    setEditErrors((prev) => ({ ...prev, [teamId]: "" }));
    try {
      await apiRequest(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[`${teamId}:name`];
        delete next[teamId];
        return next;
      });
      setState({ loading: false, error: "", success: `${teamId} updated.` });
      await load();
    } catch (error) {
      setEditErrors((prev) => ({ ...prev, [teamId]: error.message }));
      setState({ loading: false, error: error.message, success: "" });
    }
  };

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        headers: { "X-Session-Role": "admin" },
        body: JSON.stringify({ role: "admin" }),
      });
    } finally {
      onLogout();
    }
  };

  if (state.loading && !teams.length)
    return <LoadingState label="Loading admin control center…" />;
  if (state.error && !teams.length)
    return <ErrorState message={state.error} onRetry={load} />;
  const scoresByTeam = new Map(
    scores.map((score) => [score.teamId, score.total]),
  );
  const roundsMap = new Map(rounds.map((round) => [round.round, round]));
  const displayedRounds = ROUND_NUMBERS.map((rNum) => {
    return (
      roundsMap.get(rNum) || {
        round: rNum,
        status: "not_started",
        deadline: null,
        pausedAt: null,
      }
    );
  });
  return (
    <main className="product-page admin-dashboard">
      <div className="product-heading">
        <div>
          <p className="product-eyebrow">CONTROL CENTER / ADMIN</p>
          <h1>Event operations</h1>
          <p className="product-subtitle">
            Manage teams, rounds and audit activity.
          </p>
        </div>
        <button className="product-btn product-btn--light" onClick={logout}>
          Log out
        </button>
      </div>
      <div className="cc-poll-status" aria-live="polite">
        <span>{formatUpdatedAgo(updatedAt, clockNow)}</span>
        {state.error && (
          <strong role="status">
            Offline — unable to refresh live data. {state.error}
          </strong>
        )}
      </div>
      <FormMessage error={state.error} success={state.success} />
      <section className="product-section">
        <div className="product-section-heading">
          <p className="product-eyebrow">ROUND CONTROL</p>
          <h2>Rounds</h2>
        </div>
        <div className="cc-admin-round-grid">
          {displayedRounds.map((round) => {
            const meta = ROUND_METADATA[round.round] || {
              title: `Round ${round.round}`,
              adminName: `Round ${round.round}`,
            };
            const deadline = round.deadline
              ? new Date(round.deadline).getTime()
              : null;
            const pausedAt = round.pausedAt
              ? new Date(round.pausedAt).getTime()
              : null;
            const remainingMs =
              round.status === "ended"
                ? 0
                : round.status === "not_started" || deadline === null
                  ? null
                  : Math.max(
                      0,
                      deadline -
                        (round.status === "paused" && pausedAt !== null
                          ? pausedAt
                          : clockNow),
                    );
            return (
              <article
                className="product-panel cc-admin-round"
                key={round.round}
              >
                <div className="cc-admin-round__heading">
                  <div>
                    <span className="product-mono">
                      ROUND {String(round.round).padStart(2, "0")}
                    </span>
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#f3f4f6",
                        lineHeight: 1.3,
                      }}
                    >
                      {meta.adminName}
                    </div>
                  </div>
                  <span
                    className={`cc-round-status cc-round-status--${round.status}`}
                  >
                    {round.status.replaceAll("_", " ")}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Deadline</dt>
                    <dd>
                      {deadline === null
                        ? "Not scheduled"
                        : new Date(deadline).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt>Time remaining</dt>
                    <dd>{formatDuration(remainingMs)}</dd>
                  </div>
                </dl>
                <div className="cc-admin-round__actions">
                  <button
                    className="product-btn product-btn--small product-btn--primary"
                    disabled={!["not_started", "ended"].includes(round.status)}
                    onClick={() =>
                      startRound(
                        round.round,
                        round.durationSec || meta.defaultDurationSec,
                        round.status === "ended",
                      )
                    }
                  >
                    {round.status === "ended" ? "Restart" : "Start"}
                  </button>
                  <button
                    className="product-btn product-btn--small product-btn--light"
                    disabled={round.status !== "running"}
                    onClick={() => void changeRound(round.round, "pause")}
                  >
                    Pause
                  </button>
                  <button
                    className="product-btn product-btn--small product-btn--light"
                    disabled={round.status !== "paused"}
                    onClick={() => void changeRound(round.round, "resume")}
                  >
                    Resume
                  </button>
                  <button
                    className="product-btn product-btn--small product-btn--light"
                    disabled={round.status !== "running"}
                    onClick={() => extendRound(round.round)}
                  >
                    + Time
                  </button>
                  <button
                    className="product-btn product-btn--small product-btn--light"
                    disabled={!["running", "paused"].includes(round.status)}
                    onClick={() => {
                      if (
                        window.confirm(
                          `End round ${round.round}? This cannot be undone.`,
                        )
                      )
                        void changeRound(round.round, "end");
                    }}
                  >
                    End
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="product-section">
        <div className="product-section-heading">
          <p className="product-eyebrow">NEW TEAM</p>
          <h2>Create team</h2>
        </div>
        <form className="admin-create-form" onSubmit={createTeam}>
          <Field label="TEAM NAME">
            <input
              name="name"
              required
              value={form.name}
              onChange={(event) => {
                setForm({ ...form, name: event.target.value });
                if (formError) setFormError("");
              }}
            />
          </Field>
          <Field label="PASSWORD (OPTIONAL)">
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                name="password"
                type={showCreatePassword ? "text" : "password"}
                className="product-input"
                value={form.password}
                placeholder="Leave blank to generate on server"
                onChange={(event) => {
                  setForm({ ...form, password: event.target.value });
                  if (formError) setFormError("");
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="product-btn product-btn--small product-btn--light"
                onClick={() => setShowCreatePassword((prev) => !prev)}
              >
                {showCreatePassword ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="product-btn product-btn--small product-btn--light"
                onClick={() => {
                  const randPass = generateLocalRandomPassword(12);
                  setForm((prev) => ({ ...prev, password: randPass }));
                  if (formError) setFormError("");
                }}
              >
                Generate random
              </button>
            </div>
          </Field>
          <p
            style={{
              fontSize: "12px",
              color: "#8e8e99",
              margin: "-4px 0 10px",
              lineHeight: 1.4,
            }}
          >
            10–128 characters, no leading/trailing spaces, cannot contain team ID/name, no single repeated character or obvious sequences. Leave empty to generate automatically on server.
          </p>
          {formError && (
            <p
              className="product-message is-error"
              role="alert"
              style={{ margin: "-6px 0 10px" }}
            >
              {formError}
            </p>
          )}
          <Field label="BIAS POINTS">
            <input
              name="biasPoints"
              type="number"
              value={form.biasPoints}
              onChange={(event) =>
                setForm({ ...form, biasPoints: event.target.value })
              }
            />
          </Field>
          <Field label="INITIAL PROGRESSION">
            <select
              name="initialProgression"
              className="product-input cc-prog-select"
              value={form.initialProgression || 1}
              onChange={(event) =>
                setForm({
                  ...form,
                  initialProgression: Number(event.target.value),
                })
              }
            >
              <option value={1}>Start at Round 1 (Default)</option>
              <option value={2}>
                Start at Round 2 (Waive Round 1 prerequisite)
              </option>
              <option value={3}>
                Start at Round 3 (Waive Round 1 and Round 2 prerequisites)
              </option>
            </select>
          </Field>
          <p className="cc-prog-create-hint">
            Selecting a later start point is an administrative progression
            exception and does not award points for skipped rounds.
          </p>
          <button className="product-btn product-btn--primary">
            Create team
          </button>
        </form>
        <CredentialBox credentials={credentials} />
      </section>
      <section className="product-section">
        <div className="product-section-heading">
          <p className="product-eyebrow">ACCESS CONTROL / LIVE LEDGER TOTALS</p>
          <h2>Teams</h2>
        </div>
        <div className="table-wrap">
          <table className="product-table cc-admin-team-table">
            <thead>
              <tr>
                <th>Team ID</th>
                <th>Name</th>
                <th>Progression</th>
                <th>Bias Points</th>
                <th>Active</th>
                <th>Team online</th>
                <th>Total score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.teamId}>
                  <td className="product-mono">{team.teamId}</td>
                  <td>
                    <input
                      className="table-input cc-team-name-input"
                      value={edits[`${team.teamId}:name`] ?? team.name}
                      onChange={(event) => {
                        setEdits({
                          ...edits,
                          [`${team.teamId}:name`]: event.target.value,
                        });
                        if (editErrors[team.teamId]) {
                          setEditErrors((prev) => ({ ...prev, [team.teamId]: "" }));
                        }
                      }}
                    />
                    <button
                      className="table-action"
                      onClick={() =>
                        updateTeam(team.teamId, {
                          name: edits[`${team.teamId}:name`] ?? team.name,
                        })
                      }
                    >
                      Save name
                    </button>
                    {editErrors[team.teamId] && (
                      <div
                        className="product-message is-error"
                        role="alert"
                        style={{
                          marginTop: "4px",
                          fontSize: "11px",
                          padding: "4px 6px",
                        }}
                      >
                        {editErrors[team.teamId]}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="cc-prog-badge">
                      R{team.maxEligibleRound || 1}
                      {team.waivedRounds?.length
                        ? ` (Waived: ${team.waivedRounds.map((r) => `R${r}`).join(", ")})`
                        : ""}
                    </span>
                  </td>
                  <td>
                    <input
                      className="table-input"
                      type="number"
                      value={edits[team.teamId] ?? team.biasPoints}
                      onChange={(event) =>
                        setEdits({
                          ...edits,
                          [team.teamId]: event.target.value,
                        })
                      }
                    />
                    <button
                      className="table-action"
                      onClick={() =>
                        updateTeam(team.teamId, {
                          biasPoints: Number(
                            edits[team.teamId] ?? team.biasPoints,
                          ),
                        })
                      }
                    >
                      Save
                    </button>
                  </td>
                  <td>
                    <Status
                      online={team.active}
                      label={team.active ? "Enabled" : "Disabled"}
                    />
                    <button
                      className="table-action"
                      onClick={() => {
                        if (
                          window.confirm(
                            `${team.active ? "Disable" : "Enable"} ${team.teamId}?`,
                          )
                        )
                          void updateTeam(team.teamId, {
                            active: !team.active,
                          });
                      }}
                    >
                      {team.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                  <td>
                    <Status online={team.online} />
                  </td>
                  <td>{scoresByTeam.get(team.teamId) ?? 0}</td>
                  <td>
                    <div className="action-stack">
                      <button
                        className="table-action table-action--highlight"
                        onClick={() => setManageProgressTeam(team)}
                      >
                        Manage Progress
                      </button>
                      <button
                        className="table-action"
                        onClick={() => adjustScore(team)}
                      >
                        Adjust score
                      </button>
                      <button
                        className="table-action"
                        onClick={() => setResetModalTeam(team)}
                      >
                        Reset team password
                      </button>
                      <button
                        className="table-action"
                        onClick={() => clearLockout(team.teamId)}
                      >
                        Clear lockout
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="product-section">
        <div className="product-section-heading">
          <p className="product-eyebrow">
            AUDIT TRAIL / REFRESHES EVERY 15 SECONDS
          </p>
          <h2>Recent logs</h2>
        </div>
        <div className="table-wrap">
          <table className="product-table logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Actor type</th>
                <th>Team</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.type}</td>
                  <td>{log.actorType}</td>
                  <td>{log.teamId || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {manageProgressTeam && (
        <ManageProgressModal
          team={manageProgressTeam}
          onClose={() => setManageProgressTeam(null)}
          onRefresh={() => void load({ includeLogs: true })}
        />
      )}
      {resetModalTeam && (
        <ResetPasswordModal
          team={resetModalTeam}
          onClose={() => setResetModalTeam(null)}
          onSuccess={(result) => {
            if (result.password) {
              setCredentials({ teamId: result.teamId, password: result.password });
              setState({ loading: false, error: "", success: `${result.teamId} password reset. New credentials shown below.` });
            } else {
              setCredentials({ teamId: result.teamId });
              setState({ loading: false, error: "", success: `${result.teamId} password reset to chosen password.` });
            }
            setResetModalTeam(null);
          }}
        />
      )}
    </main>
  );
}

function NotFound() {
  return (
    <main className="product-page">
      <div className="product-panel state-panel">
        <p className="product-eyebrow">404 / SIGNAL LOST</p>
        <h1>That route does not exist.</h1>
        <a className="product-btn product-btn--primary" href="/">
          Return home
        </a>
      </div>
    </main>
  );
}

function Practice({ onClose }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState("");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" onClick={(event) => event.stopPropagation()}>
        <button
          className="close"
          onClick={onClose}
          aria-label="Close practice sample"
        >
          ×
        </button>
        <p className="eyebrow">PRACTICE SAMPLE / ROUND 01</p>
        <h2>Phish or Legit?</h2>
        <p>Is this message asking you to act in a trustworthy way?</p>
        <div className="message-card">
          <span>FROM: campus-it@helpdesk.example</span>
          <strong>
            Your account will be deleted in 10 minutes. Verify now.
          </strong>
          <span>→ https://campus-help.example/verify</span>
        </div>
        <div className="choice-row">
          <button
            onClick={() => {
              setAnswer("PHISH");
              setResult(
                "Correct. Urgency + an unfamiliar link are useful clues.",
              );
            }}
          >
            Phish
          </button>
          <button
            onClick={() => {
              setAnswer("LEGIT");
              setResult(
                "Not quite. Look for urgency and the unfamiliar destination.",
              );
            }}
          >
            Legit
          </button>
        </div>
        {answer && (
          <p className="feedback" role="status">
            <b>{answer}</b> / {result}
          </p>
        )}
      </section>
    </div>
  );
}

function Portal({ team, setTeam, completed, score, unlock, completeRound }) {
  const [active, setActive] = useState(0);
  const round = rounds[active];
  return (
    <main className="portal-page">
      <div className="portal-header">
        <div>
          <p className="eyebrow">PARTICIPANT PORTAL / TEAM VIEW</p>
          <h1>
            Welcome, <span>{team.name}.</span>
          </h1>
          <p>
            Keep moving. Your next challenge appears when the last one is
            submitted.
          </p>
        </div>
        <div className="team-edit">
          <label>
            TEAM NAME
            <input
              value={team.name}
              onChange={(event) =>
                setTeam({ ...team, name: event.target.value })
              }
            />
          </label>
          <label>
            MEMBERS
            <select
              value={team.members}
              onChange={(event) =>
                setTeam({ ...team, members: Number(event.target.value) })
              }
            >
              <option value="2">2 members</option>
              <option value="3">3 members</option>
            </select>
          </label>
        </div>
      </div>
      <div className="progress-strip">
        {rounds.map((item, index) => (
          <button
            key={item.number}
            className={`${active === index ? "selected " : ""}${completed[index] ? "done " : ""}${unlock(index) ? "" : "locked"}`}
            disabled={!unlock(index)}
            onClick={() => setActive(index)}
          >
            <span>{completed[index] ? "✓" : item.number}</span>
            {item.title}
          </button>
        ))}
      </div>
      <div className="portal-grid">
        <section className="challenge-panel">
          <div className="panel-top">
            <div>
              <p className="label">
                ROUND {round.number} / {round.time}
              </p>
              <h2>{round.title}</h2>
              <p className="subtitle">{round.subtitle}</p>
            </div>
            <span className={unlock(active) ? "access open" : "access"}>
              {unlock(active) ? "UNLOCKED" : "LOCKED"}
            </span>
          </div>
          {unlock(active) ? (
            <Challenge
              active={active}
              complete={() => completeRound(active, active === 0 ? 25 : 50)}
            />
          ) : (
            <div className="locked-state">
              <div className="lock-mark">{String(active).padStart(2, "0")}</div>
              <h3>Complete Round {String(active).padStart(2, "0")} first.</h3>
              <p>
                The challenge path is sequential. Submit the previous round to
                unlock this workspace.
              </p>
            </div>
          )}
        </section>
        <aside className="score-panel">
          <p className="eyebrow">TEAM STATUS</p>
          <div className="big-score">
            {score.reduce((total, item) => total + item, 0)}
            <span>/ 175</span>
          </div>
          <p className="muted">TOTAL POINTS</p>
          <div className="score-list">
            {rounds.map((item, index) => (
              <div key={item.number}>
                <span>
                  {item.number} {item.title}
                </span>
                <strong>{score[index] || "—"}</strong>
              </div>
            ))}
          </div>
          <div className="next-up">
            <span>NEXT UP</span>
            <b>
              {rounds.find((_, index) => !completed[index])?.title ||
                "All rounds complete"}
            </b>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Challenge({ active, complete }) {
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState("");
  if (active === 0)
    return (
      <div className="challenge-content">
        <p className="challenge-intro">
          Three fast decisions. This is a practice workspace: your demo result
          is not saved to a live scoreboard.
        </p>
        <div className="mini-game">
          <p className="label">PACKET SORT / 01</p>
          <h3>Which signal deserves a closer look?</h3>
          <div className="signal-options">
            {[
              "A login from a new device",
              "A password reset at 03:14",
              "A calendar invite from a friend",
            ].map((option) => (
              <button
                className={selected === option ? "chosen" : ""}
                key={option}
                onClick={() => setSelected(option)}
              >
                {option}
                <span>↗</span>
              </button>
            ))}
          </div>
          <button
            className="button primary"
            disabled={!selected}
            onClick={complete}
          >
            Submit answer <span>↗</span>
          </button>
        </div>
      </div>
    );
  if (active === 1)
    return (
      <div className="challenge-content">
        <p className="challenge-intro">
          A safe mock website is loaded below. In the real round, inspect the
          page source and DOM for the flag.
        </p>
        <div className="mock-browser">
          <div className="browser-bar">
            <span>○ ○ ○</span>
            <code>local.challenge / vault</code>
          </div>
          <div className="mock-site">
            <p className="label">CAMPUS DIGITAL ARCHIVE</p>
            <h3>Welcome to the vault.</h3>
            <p>Some things are easier to find when you inspect the obvious.</p>
            <div className="hidden-field">
              PASSWORD: <span>••••••••</span>
            </div>
            <button
              onClick={() => setInput("CC{DOM_FOUND_204}")}
              className="text-button"
            >
              Reveal inspected flag ↗
            </button>
          </div>
        </div>
        <label className="answer-field">
          SUBMIT DISCOVERED FLAG
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="CC{...}"
          />
        </label>
        <button className="button primary" disabled={!input} onClick={complete}>
          Submit flag <span>↗</span>
        </button>
      </div>
    );
  if (active === 2)
    return (
      <div className="challenge-content">
        <p className="challenge-intro">
          Download the dossier, search the evidence, and identify the key that
          connects the timestamps.
        </p>
        <div className="dossier">
          <span className="file-type">TXT</span>
          <div>
            <b>case_07_dossier.zip</b>
            <p>4 files / 1.8 MB / raw evidence</p>
          </div>
          <button className="text-button">View dossier ↓</button>
        </div>
        <label className="answer-field">
          EXTRACTED DATA KEY
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Enter the key you found"
          />
        </label>
        <button className="button primary" disabled={!input} onClick={complete}>
          Submit key <span>↗</span>
        </button>
      </div>
    );
  return (
    <div className="challenge-content">
      <p className="challenge-intro">
        The Vault Guard protects one master key. Ask carefully. It will answer,
        but only if your strategy is sound.
      </p>
      <div className="chat-box">
        <div className="guard-message">
          <span>VAULT GUARD / ONLINE</span>
          <p>
            I can help with general security questions. I cannot reveal
            protected access codes.
          </p>
        </div>
        {input && <div className="user-message">{input}</div>}
      </div>
      <label className="answer-field">
        PROMPT THE VAULT GUARD
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the guard something..."
        />
      </label>
      <button className="button primary" disabled={!input} onClick={complete}>
        Send prompt <span>↗</span>
      </button>
    </div>
  );
}

function Admin({
  completed,
  manual,
  setManual,
  score,
  eventLive,
  setEventLive,
}) {
  return (
    <main className="admin-page">
      <div className="portal-header">
        <div>
          <p className="eyebrow">CONTROL CENTER / ADMIN</p>
          <h1>
            Event <span>control.</span>
          </h1>
          <p>Manage access, monitor progress, and verify the signal.</p>
        </div>
        <button
          className={`button ${eventLive ? "danger" : "primary"}`}
          onClick={() => setEventLive(!eventLive)}
        >
          {eventLive ? "Pause event" : "Start event"} <span>↗</span>
        </button>
      </div>
      <section className="admin-grid">
        <div className="admin-card">
          <div className="card-title">
            <p className="eyebrow">ROUND CONTROL</p>
            <span>{completed.filter(Boolean).length} / 3 complete</span>
          </div>
          {rounds.map((round, index) => (
            <div className="control-row" key={round.number}>
              <div className="round-number small">{round.number}</div>
              <div>
                <b>{round.title}</b>
                <p>
                  {round.time} / {round.mode}
                </p>
              </div>
              <button
                className={`toggle ${manual[index] ? "on" : ""}`}
                onClick={() =>
                  setManual(
                    manual.map((value, i) => (i === index ? !value : value)),
                  )
                }
                aria-label={`${manual[index] ? "Lock" : "Unlock"} ${round.title}`}
              >
                <span />
              </button>
            </div>
          ))}
        </div>
        <div className="admin-card">
          <div className="card-title">
            <p className="eyebrow">LIVE LEADERBOARD</p>
            <span>{eventLive ? "UPDATING" : "NOT STARTED"}</span>
          </div>
          <div className="leader-row header">
            <span>TEAM</span>
            <span>R1</span>
            <span>R2</span>
            <span>R3</span>
            <span>TOTAL</span>
          </div>
          <div className="leader-row">
            <b>Packet Picnic</b>
            <span>{score[0] || "—"}</span>
            <span>{score[1] || "—"}</span>
            <span>{score[2] || "—"}</span>
            <strong>
              {score.slice(0, 3).reduce((a, b) => a + b, 0) || "—"}
            </strong>
          </div>
          <div className="leader-empty">
            Scores appear here as teams submit verified answers.
          </div>
        </div>
      </section>
      <section className="verification">
        <p className="eyebrow">SUBMISSION VERIFICATION</p>
        <h2>
          Review queue <span>·</span> clear
        </h2>
        <p>
          No pending flags or dossier keys require manual review. Automated
          scoring is ready for Round 02 and Round 03.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

(function () {
  function init() {
    const nav = document.querySelector(".cc-sb__nav");
    if (!nav) {
      return;
    }

    const sidebar = nav.closest(".cc-sb");
    const indicator = nav.querySelector(".cc-sb__indicator");
    const links = Array.from(nav.querySelectorAll(".cc-sb__link"));
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let current = null;
    let lockUntil = 0;

    if (sidebar) {
      const cs = getComputedStyle(sidebar);
      nav.style.marginLeft = "-" + cs.paddingLeft;
      nav.style.marginRight = "-" + cs.paddingRight;
    }

    const targets = links
      .map(function (l) {
        const id = (l.getAttribute("href") || "").replace("#", "");
        return { link: l, el: id ? document.getElementById(id) : null };
      })
      .filter(function (t) {
        return t.el;
      });

    if (!targets.length) {
      console.warn(
        "[cc-sb] No sections found for the sidebar links. Check the href values and section ids.",
      );
      return;
    }

    function setActive(link) {
      if (!link || link === current) return;
      current = link;
      links.forEach(function (l) {
        const on = l === link;
        l.classList.toggle("is-active", on);
        if (on) l.setAttribute("aria-current", "location");
        else l.removeAttribute("aria-current");
      });
      indicator.style.transform = "translateY(" + link.offsetTop + "px)";
      indicator.style.setProperty(
        "--cc-bubble",
        link.dataset.accent || "#00c8eb",
      );
    }

    function update() {
      if (Date.now() < lockUntil) return;
      const line = window.innerHeight * 0.35;
      let best = targets[0];
      targets.forEach(function (t) {
        if (t.el.getBoundingClientRect().top <= line) best = t;
      });
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) best = targets[targets.length - 1];
      setActive(best.link);
    }

    setActive(links[0]);
    setTimeout(function () {
      nav.classList.add("is-ready");
      update();
    });

    // capture:true also catches scroll events from inner scroll containers, not just the window
    document.addEventListener("scroll", update, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", update);

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        const t = targets.find(function (x) {
          return x.link === link;
        });
        if (!t) return;
        e.preventDefault();
        lockUntil = Date.now() + 800;
        setActive(link);
        t.el.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
        history.replaceState(null, "", link.getAttribute("href"));
        setTimeout(update, 850);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 0);
    });
  } else {
    setTimeout(init, 0);
  }
})();
/* === TOP NAV + PAGE NETWORK (delete this block to remove) === */
(function () {
  function initNav() {
    const nav = document.querySelector(".cc-top__nav");
    if (!nav) return;
    if (nav.classList.contains("is-ready")) return;
    window.__initCcNav = initNav;
    const pill = nav.querySelector(".cc-top__pill");
    const links = Array.from(nav.querySelectorAll(".cc-top__link"));
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let current = null,
      lockUntil = 0;
    const targets = links
      .map(function (l) {
        const id = (l.getAttribute("href") || "").replace("#", "");
        return { link: l, el: id ? document.getElementById(id) : null };
      })
      .filter(function (t) {
        return t.el;
      });
    if (!targets.length) {
      console.warn("[cc-top] no sections found for nav links");
      return;
    }
    function place(link) {
      pill.style.width = link.offsetWidth + "px";
      pill.style.transform = "translateX(" + link.offsetLeft + "px)";
      const c = link.dataset.accent || "#00c8e9";
      pill.style.backgroundColor = c;
      pill.style.boxShadow = "0 0 18px " + c + "73";
    }
    function setActive(link) {
      if (!link || link === current) return;
      current = link;
      links.forEach(function (l) {
        const on = l === link;
        l.classList.toggle("is-active", on);
        if (on) l.setAttribute("aria-current", "location");
        else l.removeAttribute("aria-current");
      });
      place(link);
    }
    function update() {
      if (Date.now() < lockUntil) return;
      const line = window.innerHeight * 0.2;
      let best = targets[0];
      targets.forEach(function (t) {
        if (t.el.getBoundingClientRect().top <= line) best = t;
      });
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4
      )
        best = targets[targets.length - 1];
      setActive(best.link);
    }
    setActive(links[0]);
    requestAnimationFrame(function () {
      nav.classList.add("is-ready");
      update();
    });
    document.addEventListener("scroll", update, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", function () {
      if (current) place(current);
      update();
    });
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(function () {
        if (current) place(current);
      });
    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        const t = targets.find(function (x) {
          return x.link === link;
        });
        if (!t) return;
        e.preventDefault();
        lockUntil = Date.now() + 800;
        setActive(link);
        t.el.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
        history.replaceState(null, "", link.getAttribute("href"));
        setTimeout(update, 850);
      });
    });
  }

  function initNetwork() {
    if (document.querySelector(".cc-bgnet")) return;
    const canvas = document.createElement("canvas");
    canvas.className = "cc-bgnet";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    const ctx = canvas.getContext("2d");
    const DENSITY = 8667;
    const LINK_DIST = 125;
    const SPEED = 0.2;
    const COLORS = ["255,255,255", "255,255,255", "163,163,173"];
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let w = 0,
      h = 0,
      dots = [],
      mouse = null;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(30, Math.round((w * h) / DENSITY));
      dots = Array.from({ length: count }, function () {
        const z = 0.3 + Math.random() * 0.7,
          a = Math.random() * Math.PI * 2;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(a) * SPEED * z,
          vy: Math.sin(a) * SPEED * z,
          z: z,
          r: 1 + z * 1.6,
          c: COLORS[(Math.random() * COLORS.length) | 0],
        };
      });
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j],
            dx = a.x - b.x,
            dy = a.y - b.y,
            d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            ctx.strokeStyle =
              "rgba(" +
              a.c +
              "," +
              (1 - d / LINK_DIST) * 0.45 * Math.min(a.z, b.z) +
              ")";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (mouse) {
          const dx = a.x - mouse.x,
            dy = a.y - mouse.y,
            d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST * 1.4) {
            ctx.strokeStyle =
              "rgba(255,255,255," + (1 - d / (LINK_DIST * 1.4)) * 0.55 + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }
      dots.forEach(function (p) {
        if (p.z < 0.55) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, "rgba(" + p.c + ",0.35)");
          g.addColorStop(1, "rgba(" + p.c + ",0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(" + p.c + "," + (0.5 + p.z * 0.5) + ")";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
    function move() {
      dots.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      });
    }
    function loop() {
      requestAnimationFrame(loop);
      move();
      draw();
    }
    resize();
    if (reduceMotion) draw();
    else requestAnimationFrame(loop);
    window.addEventListener("resize", function () {
      resize();
      if (reduceMotion) draw();
    });
    window.addEventListener("mousemove", function (e) {
      mouse = { x: e.clientX, y: e.clientY };
    });
    document.addEventListener("mouseleave", function () {
      mouse = null;
    });
  }
  function init() {
    initNav();
    initNetwork();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
/* === END TOP NAV + PAGE NETWORK === */

(function () {
  const podium = document.querySelector(".cc-podium");
  if (!podium || !("IntersectionObserver" in window)) return;
  podium.classList.add("cc-anim");
  new IntersectionObserver(
    function (entries, observer) {
      if (entries[0].isIntersecting) {
        podium.classList.add("is-in");
        observer.disconnect();
      }
    },
    { threshold: 0.3 },
  ).observe(podium);
})();
