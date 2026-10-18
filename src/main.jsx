import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './styles.css';
import {
  CodeInspectionIcon,
  DossierSearchIcon,
  GameControllerIcon,
  UnlockedTerminalIcon,
} from './components/CardHeaderIcons.tsx';

const rounds = [
  { number: '01', title: 'Mini Games Round', subtitle: 'The Warmup & Screening', time: '30 min', mode: 'BROWSER MINI-GAMES', desc: 'Build speed and digital intuition with quick decisions, patterns, and packet sorting.', focus: 'Speed + instinct' },
  { number: '02', title: 'Inspect Element Sleuth', subtitle: 'Web UI Hijacking', time: '45 min', mode: 'MOCK LOCAL WEBSITE', desc: 'Use DevTools on a safe mock site to reveal comments, unhide fields, and edit DOM attributes.', focus: 'Web curiosity' },
  { number: '03', title: 'Digital Detective', subtitle: 'OSINT & Data Extraction', time: '45 min', mode: 'DATA DOSSIER', desc: 'Analyze raw logs, image metadata, audio clues, and a supplied dossier to solve a mystery.', focus: 'Evidence reading' },
  { number: '04', title: 'Prompt Injection / AI Jailbreak', subtitle: 'Grand Finale', time: '45 min', mode: 'VAULT GUARD AI', desc: 'Use creative natural-language prompts and strategy against an AI Digital Vault Guard.', focus: 'Creative strategy' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || 'Request failed');
  }
  return body;
}

function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [team, setTeam] = useState({ name: 'Packet Picnic', members: 2 });
  const [completed, setCompleted] = useState([false, false, false, false]);
  const [manual, setManual] = useState([true, true, true, true]);
  const [eventLive, setEventLive] = useState(false);
  const [notice, setNotice] = useState('');
  const [score, setScore] = useState([0, 0, 0, 0]);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const unlock = (index) => manual[index] && (index === 0 || completed[index - 1]);
  const completeRound = (index, points = 25) => {
    setCompleted((current) => current.map((done, i) => i === index ? true : done));
    setScore((current) => current.map((value, i) => i === index ? points : value));
    setNotice(`Round ${String(index + 1).padStart(2, '0')} submitted. Next round unlocked.`);
  };

  return (
    <div className="app-shell">
      {path === '/' && <header className="cc-top">
        <nav className="cc-top__nav" aria-label="Event navigation">
          <span className="cc-top__pill" aria-hidden="true"></span>
          <a className="cc-top__link" href="#event-brief" data-accent="#ffc933">Event brief</a>
          <a className="cc-top__link" href="#rounds" data-accent="#22c1f1">Rounds</a>
          <a className="cc-top__link" href="#scoreboard" data-accent="#ff4d5e">Scoreboard</a>
        </nav>
        <a className="cc-top__logo" href="#event-brief">
          <img src="/club-logo.jpg" alt="OsCode club logo" />
        </a>
        <a className="cc-top__cta" href="/login" onClick={(event) => { event.preventDefault(); navigate('/login'); }}>Register your team <span aria-hidden="true">↗</span></a>
      </header>}
      <div className="page-shell">
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
        {path === '/' && <Landing />}
        {path === '/login' && <Login onSuccess={() => navigate('/dashboard')} />}
        {path === '/dashboard' && <Dashboard onLogout={() => navigate('/login')} onPlay={() => navigate('/dashboard/circuit-sync')} />}
        {path === '/dashboard/circuit-sync' && <CircuitSyncScreen onBack={() => navigate('/dashboard')} onLogout={() => navigate('/login')} />}
        {path === '/leaderboard' && <LeaderboardScreen onBack={() => navigate('/dashboard')} onLogout={() => navigate('/login')} />}
        {path === '/admin/login' && <AdminLogin onSuccess={() => navigate('/admin')} />}
        {path === '/admin' && <AdminDashboard onLogout={() => navigate('/admin/login')} />}
        {!['/', '/login', '/dashboard', '/dashboard/circuit-sync', '/leaderboard', '/admin/login', '/admin'].includes(path) && <NotFound />}
      </div>
    </div>
  );
}

function Landing() {
  const [practice, setPractice] = useState(null);
  return <main>
    <section className="cc-hero" id="event-brief">
      <p className="cc-hero__presenter">OsCode Presents</p>
      <h1 className="cc-hero__title"><span className="cc-hero__w1">Cypher</span><span className="cc-hero__w2">Clash</span></h1>
      <p className="cc-hero__tag">Because writing secure code was too much work.</p>
      <div className="cc-hero__actions">
        <a className="cc-btn cc-btn--solid" href="/login">Enter participant portal <span aria-hidden="true">↗</span></a>
        <a className="cc-btn cc-btn--ghost" href="#rounds">Explore the rounds <span aria-hidden="true">↓</span></a>
      </div>
    </section>
    <section className="cc-rounds" id="rounds">
      <dl className="cc-facts">
        <div className="cc-fact"><dt>Format</dt><dd>4-round tournament</dd></div>
        <div className="cc-fact"><dt>Team size</dt><dd>2–3 members</dd></div>
        <div className="cc-fact"><dt>Entry level</dt><dd>Zero prerequisites</dd></div>
        <div className="cc-fact"><dt>When / Where</dt><dd>To be announced</dd></div>
      </dl>
      <div className="cc-fan">
        {rounds.map((round, index) => <article className={`cc-card cc-card--${index + 1}`} tabIndex="0" key={round.number}>
          <div className="cc-card__top">
            <span className="cc-card__num">{round.number}</span>
            <span className="cc-card__icon">
              {index === 0 && <GameControllerIcon size={24} title="Mini games" />}
              {index === 1 && <CodeInspectionIcon size={24} title="Code inspection" />}
              {index === 2 && <DossierSearchIcon size={24} title="Dossier search" />}
              {index === 3 && <UnlockedTerminalIcon size={24} title="Unlocked terminal" />}
            </span>
          </div>
          <div className="cc-card__body">
            <p className="cc-card__eyebrow">{round.mode} / {round.time} {index === 3 && <span className="cc-card__tag">Finale</span>}</p>
            <h3 className="cc-card__name">{round.title}</h3>
            <div className="cc-card__more"><div>
              <p className="cc-card__desc">{round.desc}</p>
              <p className="cc-card__skill"><span>Skill focus</span>{round.focus}</p>
              {index === 0 && <a className="cc-card__btn" href="#practice" onClick={(event) => { event.preventDefault(); setPractice('Phish or Legit?'); }}>Try a practice sample <span aria-hidden="true">↗</span></a>}
            </div></div>
          </div>
        </article>)}
      </div>
    </section>
    <section className="cc-board" id="scoreboard">
      <p className="cc-board__eyebrow">Scoreboard <span className="cc-board__sample">Sample data</span></p>
      <h2 className="cc-board__title">Live leaderboard preview. Final scores will appear when the event starts.</h2>

      <div className="cc-podium" aria-label="Top three teams">
        <div className="cc-pod cc-pod--2">
          <div className="cc-pod__who">
            <span className="cc-pod__avatar" aria-hidden="true">CA</span>
            <span className="cc-pod__name">Ctrl Alt Elite</span>
            <span className="cc-pod__pts">25 pts</span>
          </div>
          <div className="cc-pod__block"><span>2</span></div>
        </div>

        <div className="cc-pod cc-pod--1">
          <svg className="cc-pod__trophy" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-1.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98 1.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
          <div className="cc-pod__who">
            <span className="cc-pod__avatar" aria-hidden="true">PP</span>
            <span className="cc-pod__name">Packet Picnic</span>
            <span className="cc-pod__pts">75 pts</span>
          </div>
          <div className="cc-pod__block"><span>1</span></div>
        </div>

        <div className="cc-pod cc-pod--3">
          <div className="cc-pod__who">
            <span className="cc-pod__avatar" aria-hidden="true">BB</span>
            <span className="cc-pod__name">Byte Bandits</span>
            <span className="cc-pod__pts">— pts</span>
          </div>
          <div className="cc-pod__block"><span>3</span></div>
        </div>
      </div>

      <div className="cc-rank" role="table" aria-label="Leaderboard from rank 4">
        <div className="cc-rank__row cc-rank__row--head" role="row">
          <span role="columnheader">#</span><span role="columnheader">Team</span>
          <span role="columnheader">R1</span><span role="columnheader">R2</span>
          <span role="columnheader">R3</span><span role="columnheader">R4</span>
          <span role="columnheader">Total</span>
        </div>
        <div className="cc-rank__row" role="row">
          <span role="cell">4</span><span role="cell" className="cc-rank__team">Null Pointers</span>
          <span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span>
          <span role="cell" className="cc-rank__total">—</span>
        </div>
      </div>

      <a className="cc-btn cc-btn--ghost cc-board__cta" href="/login">Register your team <span aria-hidden="true">↗</span></a>
    </section>
    <footer><span>CYPHERCLASH / 2026</span><span>Made for curious beginners.</span></footer>
    {practice && <Practice onClose={() => setPractice(null)} />}
  </main>;
}

function AuthShell({ eyebrow, title, children }) {
  return <main className="product-page">
    <section className="product-card auth-card">
      <p className="product-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </section>
  </main>;
}

function Field({ label, children }) {
  return <label className="product-field"><span>{label}</span>{children}</label>;
}

function FormMessage({ error, success }) {
  if (!error && !success) return null;
  return <p className={`product-message ${error ? 'is-error' : 'is-success'}`} role="status">{error || success}</p>;
}

function Login({ onSuccess }) {
  const [form, setForm] = useState({ teamId: '', slot: 'P1', password: '' });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  const submit = async (event) => {
    event.preventDefault();
    setState({ loading: true, error: '', success: '' });
    try {
      await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(form) });
      setState({ loading: false, error: '', success: 'Login successful. Opening your dashboard.' });
      onSuccess();
    } catch (error) {
      setState({ loading: false, error: error.message, success: '' });
    }
  };

  return <AuthShell eyebrow="PARTICIPANT PORTAL / SECURE ACCESS" title="Team login">
    <p className="product-intro">Use the credentials issued to your team. Your session stays active when you refresh.</p>
    <form className="product-form" onSubmit={submit}>
      <Field label="TEAM ID"><input required value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value.toUpperCase() })} placeholder="CC-001" autoComplete="username" /></Field>
      <Field label="PLAYER"><select value={form.slot} onChange={(event) => setForm({ ...form, slot: event.target.value })}><option value="P1">Player 1</option><option value="P2">Player 2</option></select></Field>
      <Field label="PASSWORD"><input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" /></Field>
      <FormMessage error={state.error} success={state.success} />
      <button className="product-btn product-btn--primary" disabled={state.loading}>{state.loading ? 'Signing in…' : 'Enter dashboard'} <span aria-hidden="true">↗</span></button>
    </form>
    <a className="product-link" href="/">← Back to event brief</a>
  </AuthShell>;
}

function AdminLogin({ onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  const submit = async (event) => {
    event.preventDefault();
    setState({ loading: true, error: '', success: '' });
    try {
      await apiRequest('/api/auth/admin/login', { method: 'POST', body: JSON.stringify(form) });
      onSuccess();
    } catch (error) {
      setState({ loading: false, error: error.message, success: '' });
    }
  };

  return <AuthShell eyebrow="CONTROL CENTER / ADMIN ACCESS" title="Admin login">
    <p className="product-intro">Administrative access is restricted to event staff.</p>
    <form className="product-form" onSubmit={submit}>
      <Field label="USERNAME"><input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="username" /></Field>
      <Field label="PASSWORD"><input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" /></Field>
      <FormMessage error={state.error} success={state.success} />
      <button className="product-btn product-btn--primary" disabled={state.loading}>{state.loading ? 'Signing in…' : 'Open control center'} <span aria-hidden="true">↗</span></button>
    </form>
    <a className="product-link" href="/">← Back to event brief</a>
  </AuthShell>;
}

function Status({ online, label }) {
  return <span className={`product-status ${online ? 'is-online' : ''}`}><i />{label || (online ? 'Online' : 'Offline')}</span>;
}

function Dashboard({ onLogout, onPlay }) {
  const [state, setState] = useState({ loading: true, error: '', team: null, score: null });
  const [clockNow, setClockNow] = useState(Date.now());

  const loadTeam = async () => {
    try {
      const [team, score] = await Promise.all([
        apiRequest('/api/team/me'),
        apiRequest('/api/team/score'),
      ]);
      setState({ loading: false, error: '', team, score });
    } catch (error) {
      if (error.message === 'Authentication required') onLogout();
      else setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  };

  useEffect(() => {
    loadTeam();
    const refresh = window.setInterval(loadTeam, 20_000);
    const clock = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, []);

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      onLogout();
    }
  };

  if (state.loading) return <LoadingState label="Loading team dashboard…" />;
  if (state.error) return <ErrorState message={state.error} onRetry={loadTeam} />;
  const players = state.team.players || [];
  const round = state.team.currentRound;
  const roundDeadline = round?.deadline ? new Date(round.deadline).getTime() : null;
  const pausedAt = round?.pausedAt ? new Date(round.pausedAt).getTime() : null;
  const remainingMs = roundDeadline === null
    ? null
    : Math.max(0, roundDeadline - (round.status === 'paused' && pausedAt !== null ? pausedAt : clockNow));
  return <main className="product-page dashboard-page">
    <div className="product-heading">
      <div><p className="product-eyebrow">PARTICIPANT PORTAL / TEAM DASHBOARD</p><h1>{state.team.name}</h1><p className="product-subtitle">Team ID <strong>{state.team.teamId}</strong></p></div>
      <button className="product-btn product-btn--light" onClick={logout}>Log out</button>
    </div>
    <section className="product-stat-grid">
      <div className="product-stat"><span>BIAS POINTS</span><strong>{state.team.biasPoints}</strong></div>
      <div className="product-stat"><span>TEAM SCORE</span><strong>{state.score?.total ?? 0}</strong></div>
    </section>
    <section className="product-section"><div className="product-section-heading"><p className="product-eyebrow">TEAM MEMBERS / {players.filter((player) => player.online).length} OF 2 ONLINE</p><h2>Signal crew</h2></div><div className="player-grid">{['P1', 'P2'].map((slot) => {
      const player = players.find((item) => item.slot === slot);
      return <article className="product-panel player-panel" key={slot}><span className="product-mono">{slot === 'P1' ? 'PLAYER 1' : 'PLAYER 2'}</span><h3>{slot}</h3><Status online={Boolean(player?.online)} /></article>;
    })}</div></section>
    <section className="product-section cc-dashboard-round">
      <div className="product-section-heading"><p className="product-eyebrow">ROUND STATUS</p><h2>{round?.round ? `Round ${String(round.round).padStart(2, '0')}` : 'No round started'}</h2></div>
      <div className="cc-dashboard-round__detail">
        <span className={`cc-round-status cc-round-status--${round?.status || 'not_started'}`}>{round?.status === 'paused' ? 'PAUSED' : (round?.status || 'not started').replaceAll('_', ' ')}</span>
        <strong>{formatDuration(remainingMs)}</strong>
        {round?.status === 'running' && <button className="product-btn product-btn--primary" onClick={onPlay}>Open Circuit Sync <span aria-hidden="true">↗</span></button>}
        {round?.status === 'not_started' && <p>The next round has not started yet.</p>}
        {round?.status === 'paused' && <p>Play is paused. Your remaining time is frozen.</p>}
        {round?.status === 'ended' && <p>This round has ended.</p>}
      </div>
    </section>
    <section className="product-section">
      <div className="product-section-heading"><p className="product-eyebrow">YOUR SCORE / LEDGER TOTALS</p><h2>Round breakdown</h2></div>
      <div className="cc-score-breakdown">
        {Object.entries(state.score?.rounds || {}).sort(([first], [second]) => Number(first) - Number(second)).map(([roundNumber, points]) => (
          <div className="product-panel cc-score-row" key={roundNumber}><span>ROUND {String(roundNumber).padStart(2, '0')}</span><strong>{points}</strong></div>
        ))}
        {!Object.keys(state.score?.rounds || {}).length && <p className="product-subtitle">No score has been recorded yet.</p>}
      </div>
    </section>
    <div className="cc-dashboard-leaderboard-link">
      <button className="product-btn product-btn--light" onClick={() => navigate('/leaderboard')}>View live leaderboard <span aria-hidden="true">↗</span></button>
    </div>
  </main>;
}

function LeaderboardScreen({ onBack, onLogout }) {
  const socketRef = useRef(null);
  const connectedRef = useRef(false);
  const previousRanks = useRef(new Map());
  const [board, setBoard] = useState({ rows: [], updatedAt: null, youIndex: null });
  const [state, setState] = useState({ loading: true, error: '' });
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [changedTeams, setChangedTeams] = useState(new Set());

  const applyBoard = (next) => {
    if (!next || !Array.isArray(next.rows)) return;
    const nextRanks = new Map(next.rows.map((row) => [row.name, row.rank]));
    const changed = new Set(next.rows
      .filter((row) => previousRanks.current.has(row.name) && previousRanks.current.get(row.name) !== row.rank)
      .map((row) => row.name));
    previousRanks.current = nextRanks;
    setChangedTeams(changed);
    setBoard(next);
    setState({ loading: false, error: '' });
  };

  const loadBoard = async () => {
    try {
      applyBoard(await apiRequest('/api/leaderboard'));
    } catch (error) {
      if (error.message === 'Authentication required') onLogout();
      else setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  };

  useEffect(() => {
    const socket = io(API_URL, { withCredentials: true });
    socketRef.current = socket;
    void loadBoard();
    socket.on('connect', () => {
      connectedRef.current = true;
      setConnected(true);
      setState((current) => ({ ...current, error: '' }));
    });
    socket.on('disconnect', () => {
      connectedRef.current = false;
      setConnected(false);
    });
    socket.on('connect_error', (error) => {
      connectedRef.current = false;
      setConnected(false);
      if (error.message.toLowerCase().includes('authentication')) {
        setState({ loading: false, error: 'Your player session is no longer valid.' });
      }
    });
    socket.on('lb:update', applyBoard);
    const fallback = window.setInterval(() => {
      if (!connectedRef.current) void loadBoard();
    }, 30_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(fallback);
      window.clearInterval(clock);
      socket.disconnect();
      socketRef.current = null;
      connectedRef.current = false;
    };
  }, []);

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      onLogout();
    }
  };

  const topThree = board.rows.slice(0, 3);
  const remainingRows = board.rows.slice(3);
  const updatedSeconds = board.updatedAt
    ? Math.max(0, Math.floor((now - new Date(board.updatedAt).getTime()) / 1000))
    : null;
  if (state.loading) return <LoadingState label="Loading live leaderboard…" />;
  if (state.error && !board.updatedAt) return <ErrorState message={state.error} onRetry={loadBoard} />;
  return <main className="product-page cc-leaderboard-page">
    <div className="product-heading cc-leaderboard-heading">
      <div><p className="product-eyebrow">LIVE EVENT / SCOREBOARD</p><h1>Leaderboard</h1><p className="product-subtitle">Ranked by round points. Bias Points are separate.</p></div>
      <div className="cc-leaderboard-actions">
        <span className={`cc-circuit-connection ${connected ? 'is-connected' : ''}`}><i />{connected ? 'LIVE UPDATES' : 'LIVE UPDATES RECONNECTING'}</span>
        <button className="product-btn product-btn--light" onClick={onBack}>Back to dashboard</button>
      </div>
    </div>
    <div className="cc-leaderboard-meta" aria-live="polite">
      <span>{updatedSeconds === null ? 'Waiting for first update' : `Updated ${updatedSeconds}s ago`}</span>
      {!connected && <span>Refresh fallback active (30 seconds)</span>}
    </div>
    {state.error && <FormMessage error={state.error} />}
    {!board.rows.length ? <section className="product-panel cc-leaderboard-empty"><p className="product-eyebrow">NO SCORES YET</p><h2>The leaderboard is empty.</h2><p>Active teams and rankings will appear here.</p></section> : <>
      <section className="cc-leaderboard-podium" aria-label="Top three teams">
        {topThree.map((row, index) => <article
          key={`${row.name}-${index}`}
          className={`product-panel cc-leaderboard-podium__card cc-leaderboard-podium__card--${index + 1} ${board.youIndex === index ? 'is-you' : ''} ${changedTeams.has(row.name) ? 'rank-changed' : ''}`}
        >
          <span className="product-mono">RANK {row.rank}{board.youIndex === index ? ' / YOUR TEAM' : ''}</span>
          <h2>{row.name}</h2>
          <strong className="cc-leaderboard-podium__total">{row.total}</strong>
          <LeaderboardRoundDetails row={row} />
        </article>)}
      </section>
      {remainingRows.length > 0 && <section className="product-section">
        <div className="product-section-heading"><p className="product-eyebrow">RANK 4+</p><h2>Team standings</h2></div>
        <div className="table-wrap">
          <table className="product-table cc-leaderboard-table">
            <thead><tr><th>Rank</th><th>Team</th><th>Bias Points</th><th>R1</th><th>R2</th><th>R3</th><th>Total</th></tr></thead>
            <tbody>{remainingRows.map((row, index) => {
              const absoluteIndex = index + 3;
              const isYou = board.youIndex === absoluteIndex;
              return <tr key={`${row.name}-${absoluteIndex}`} className={`${isYou ? 'is-you' : ''} ${changedTeams.has(row.name) ? 'rank-changed' : ''}`}>
                <td>{row.rank}</td><td className="cc-leaderboard-table__team">{row.name}{isYou && <small>YOUR TEAM</small>}</td>
                <td>{row.bias}</td><td>{formatLeaderboardRound(row.r1)}</td><td>{formatLeaderboardRound(row.r2)}</td><td>{formatLeaderboardRound(row.r3)}</td><td className="cc-leaderboard-table__total">{row.total}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>}
    </>}
  </main>;
}

function formatLeaderboardRound(points) {
  return points === null ? '–' : points;
}

function LeaderboardRoundDetails({ row }) {
  return <dl className="cc-leaderboard-podium__details">
    {[['BIAS', row.bias], ['R1', formatLeaderboardRound(row.r1)], ['R2', formatLeaderboardRound(row.r2)], ['R3', formatLeaderboardRound(row.r3)]].map(([label, value]) => (
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
    ))}
  </dl>;
}

function CircuitSyncScreen({ onBack, onLogout }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [presence, setPresence] = useState({ teammateConnected: false });
  const [gameState, setGameState] = useState(null);
  const [roundState, setRoundState] = useState({ status: 'connecting', round: null, remainingMs: null });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [lockedMs, setLockedMs] = useState(0);

  useEffect(() => {
    const socket = io(API_URL, { withCredentials: true });
    socketRef.current = socket;
    setReconnecting(true);
    socket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      setMessage({ type: '', text: '' });
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setReconnecting(true);
    });
    socket.on('connect_error', (error) => {
      setConnected(false);
      setReconnecting(true);
      if (error.message.toLowerCase().includes('authentication')) {
        setMessage({ type: 'error', text: 'Your player session is no longer valid. Please sign in again.' });
        socket.disconnect();
      } else {
        setMessage({ type: 'error', text: 'Connection failed. Reconnecting automatically…' });
      }
    });
    socket.on('cs:presence', setPresence);
    socket.on('cs:state', (nextState) => {
      setGameState(nextState);
      setLockedMs(nextState.lockedMs || 0);
      if (nextState.done) setMessage({ type: 'success', text: `Circuit Sync complete. Your team earned ${nextState.points} points.` });
    });
    socket.on('cs:round', setRoundState);
    socket.on('cs:message', setMessage);
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (lockedMs <= 0) return undefined;
    const timer = window.setInterval(() => setLockedMs((remaining) => Math.max(0, remaining - 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [lockedMs]);

  const emit = (event, payload) => {
    const socket = socketRef.current;
    if (socket?.connected) socket.emit(event, payload);
  };

  if (message.text && message.text.includes('session is no longer valid')) {
    return <main className="product-page cc-circuit-page"><section className="product-panel state-panel"><p className="product-eyebrow">SESSION ENDED</p><h1>Sign in to continue</h1><p className="product-message is-error">{message.text}</p><button className="product-btn product-btn--primary" onClick={onLogout}>Go to login</button></section></main>;
  }

  return <main className="product-page cc-circuit-page">
    <div className="product-heading cc-circuit-heading">
      <div><p className="product-eyebrow">ROUND 01 / CIRCUIT SYNC</p><h1>Circuit Sync</h1><p className="product-subtitle">Coordinate across two roles to repair the circuit.</p></div>
      <div className="cc-circuit-heading__actions">
        <span className={`cc-circuit-connection ${connected ? 'is-connected' : ''}`}><i />{connected ? 'CONNECTED' : reconnecting ? 'RECONNECTING' : 'OFFLINE'}</span>
        <button className="product-btn product-btn--light" onClick={onBack}>Back to dashboard</button>
      </div>
    </div>
    {message.text && <p className={`product-message ${message.type === 'success' ? 'is-success' : 'is-error'}`} role="status">{message.text}</p>}
    <section className="cc-circuit-roundbar" aria-live="polite">
      <span className="product-mono">{roundState.round ? `ROUND ${String(roundState.round).padStart(2, '0')}` : 'ROUND STATUS'}</span>
      <strong>{formatDuration(roundState.remainingMs)}</strong>
      <span className="cc-circuit-roundbar__status">{roundState.status.replaceAll('_', ' ')}</span>
    </section>
    {!connected && <section className="product-panel cc-circuit-wait"><h2>{reconnecting ? 'Reconnecting to the circuit…' : 'Connection unavailable'}</h2><p>{reconnecting ? 'Your session and game state will be restored automatically.' : 'Connect to continue.'}</p></section>}
    {connected && !presence.teammateConnected && <section className="product-panel cc-circuit-wait"><h2>Waiting for your teammate</h2><p>The circuit will open when both players are connected.</p></section>}
    {connected && presence.teammateConnected && !gameState && <section className="product-panel cc-circuit-wait"><h2>{roundState.status === 'running' ? 'Preparing your circuit…' : 'Waiting for the round to start'}</h2><p>Both players are connected. Your view will appear when the round is live.</p></section>}
    {connected && gameState?.done && <section className="product-panel cc-circuit-finished"><p className="product-eyebrow">GAME COMPLETE</p><h2>Team signal restored.</h2><strong>{gameState.points} POINTS</strong><button className="product-btn product-btn--light" onClick={onBack}>Return to dashboard</button></section>}
    {connected && presence.teammateConnected && gameState && !gameState.done && roundState.status === 'ended' && <section className="product-panel cc-circuit-finished"><p className="product-eyebrow">ROUND ENDED</p><h2>Circuit Sync was not completed.</h2><p>Your progress was not submitted as a game result.</p><button className="product-btn product-btn--light" onClick={onBack}>Return to dashboard</button></section>}
    {connected && presence.teammateConnected && gameState && !gameState.done && roundState.status !== 'ended' && (
      <CircuitRoleView
        state={gameState}
        lockedMs={lockedMs}
        canAct={connected && roundState.status === 'running'}
        roundStatus={roundState.status}
        onToggle={(idx) => emit('cs:toggle', { idx })}
        onSubmit={() => emit('cs:submit', {})}
      />
    )}
  </main>;
}

function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return '—:—';
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function CircuitRoleView({ state, lockedMs, canAct, roundStatus, onToggle, onSubmit }) {
  if (state.role === 'analyst') {
    return <section className="cc-circuit-game product-panel">
      <div className="cc-circuit-game__meta"><span className="product-mono">ANALYST VIEW</span><span>STAGE {state.stage} / {state.stages}</span><span>WRONG {state.wrong} / {state.maxWrong}</span></div>
      <h2>Trace the signal path</h2>
      <p className="cc-circuit-instructions">{roundStatus === 'paused' ? 'Round paused. The circuit is frozen until play resumes.' : 'Read the gate chain and guide your teammate. Your view does not include switch positions.'}</p>
      <CircuitDiagram state={state} />
    </section>;
  }
  if (state.role === 'operator') {
    return <section className="cc-circuit-game product-panel">
      <div className="cc-circuit-game__meta"><span className="product-mono">OPERATOR VIEW</span><span>STAGE {state.stage} / {state.stages}</span><span>WRONG {state.wrong} / {state.maxWrong}</span></div>
      <h2>Configure the switches</h2>
      <p className="cc-circuit-instructions">{roundStatus === 'paused' ? 'Round paused. Inputs are frozen until play resumes.' : 'Follow your teammate’s directions, then submit the circuit for a check.'}</p>
      <div className="cc-circuit-switches">
        {state.switches.map((active, idx) => <button
          className={`cc-circuit-switch ${active ? 'is-on' : ''}`}
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={`Switch ${idx + 1} ${active ? 'on' : 'off'}`}
          disabled={!canAct}
          onClick={() => onToggle(idx)}
          key={idx}
        ><span className="cc-circuit-switch__track"><i /></span><span>S{idx + 1}<small>{active ? 'ON' : 'OFF'}</small></span></button>)}
      </div>
      {state.lastFeedback && <p className="cc-circuit-feedback" role="status">{state.lastFeedback.correct === state.lastFeedback.of ? 'Signal matched' : 'Not yet'} — {state.lastFeedback.correct} of {state.lastFeedback.of} lamps correct</p>}
      <div className="cc-circuit-submit">
        <button className="product-btn product-btn--primary" disabled={!canAct || lockedMs > 0} onClick={onSubmit}>Submit circuit</button>
        {lockedMs > 0 && <span>Try again in {Math.ceil(lockedMs / 1000)}s</span>}
      </div>
    </section>;
  }
  return <section className="product-panel cc-circuit-wait"><h2>Waiting for your game view</h2><p>The server has not assigned a player role yet.</p></section>;
}

function CircuitDiagram({ state }) {
  const switchCount = state.switchCount;
  const nodeCount = switchCount + state.gates.length;
  const depths = Array(switchCount).fill(0);
  state.gates.forEach((gate, index) => {
    depths.push(Math.max(depths[gate.a], depths[gate.b]) + 1);
  });
  const nodePositions = depths.map((depth, index) => ({
    x: depth === 0 ? 95 : 125 + depth * 190,
    y: 52 + index * 76,
  }));
  const maxDepth = Math.max(...depths);
  const width = 280 + maxDepth * 190;
  const height = Math.max(230, 100 + nodeCount * 76);
  const firstLamp = nodeCount - state.lampCount;
  return <div className="cc-circuit-diagram" role="img" aria-label="Analyst circuit schematic">
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {state.gates.map((gate, gateIndex) => {
        const nodeIndex = switchCount + gateIndex;
        const output = nodePositions[nodeIndex];
        const first = nodePositions[gate.a];
        const second = nodePositions[gate.b];
        const gateX = output.x - 52;
        const firstY = output.y - 14;
        const secondY = output.y + 14;
        const firstMid = (first.x + gateX) / 2;
        const secondMid = (second.x + gateX) / 2;
        const lampIndex = nodeIndex - firstLamp;
        return <g key={nodeIndex}>
          <path className="cc-circuit-wire" d={`M ${first.x + 18} ${first.y} H ${firstMid} V ${firstY} H ${gateX}`} />
          <path className="cc-circuit-wire" d={`M ${second.x + 18} ${second.y} H ${secondMid} V ${secondY} H ${gateX}`} />
          <rect className="cc-circuit-gate" x={gateX} y={output.y - 25} width="104" height="50" rx="8" />
          <text className="cc-circuit-gate__label" x={gateX + 52} y={output.y + 4} textAnchor="middle">{gate.op}</text>
          {lampIndex >= 0 && <g>
            <path className="cc-circuit-wire" d={`M ${output.x + 52} ${output.y} H ${output.x + 95}`} />
            <circle className={`cc-circuit-lamp ${state.target[lampIndex] ? 'is-on' : ''}`} cx={output.x + 111} cy={output.y} r="12" />
            <text className="cc-circuit-lamp__label" x={output.x + 132} y={output.y + 4}>L{lampIndex + 1} {state.target[lampIndex] ? 'ON' : 'OFF'}</text>
          </g>}
        </g>;
      })}
      {Array.from({ length: switchCount }, (_, index) => {
        const position = nodePositions[index];
        return <g key={`switch-${index}`}>
          <rect className="cc-circuit-switch-node" x={position.x - 40} y={position.y - 18} width="56" height="36" rx="7" />
          <text className="cc-circuit-switch-label" x={position.x - 12} y={position.y + 4} textAnchor="middle">S{index + 1}</text>
        </g>;
      })}
    </svg>
  </div>;
}

function LoadingState({ label }) {
  return <main className="product-page"><div className="product-panel state-panel"><p className="product-eyebrow">PLEASE WAIT</p><h1>{label}</h1></div></main>;
}

function ErrorState({ message, onRetry }) {
  return <main className="product-page"><div className="product-panel state-panel"><p className="product-eyebrow">REQUEST FAILED</p><h1>Could not load this view.</h1><FormMessage error={message} /><button className="product-btn product-btn--primary" onClick={onRetry}>Try again</button></div></main>;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <button className="product-btn product-btn--small" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>;
}

function CredentialBox({ credentials }) {
  if (!credentials) return null;
  return <div className="credential-box"><strong>Credentials shown once</strong><p>Save these passwords now. They will not be displayed again.</p><div><span>Player 1 <code>{credentials.P1}</code></span><CopyButton value={credentials.P1} /></div><div><span>Player 2 <code>{credentials.P2}</code></span><CopyButton value={credentials.P2} /></div></div>;
}

function AdminDashboard({ onLogout }) {
  const [teams, setTeams] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [scores, setScores] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ name: '', biasPoints: 0 });
  const [credentials, setCredentials] = useState(null);
  const [edits, setEdits] = useState({});
  const [clockNow, setClockNow] = useState(Date.now());
  const [state, setState] = useState({ loading: true, error: '', success: '' });

  const load = async ({ includeLogs = false } = {}) => {
    try {
      const [teamData, roundData, scoreData, logData] = await Promise.all([
        apiRequest('/api/admin/teams'),
        apiRequest('/api/admin/rounds'),
        apiRequest('/api/admin/scores'),
        includeLogs ? apiRequest('/api/admin/logs') : Promise.resolve(null),
      ]);
      setTeams(teamData);
      setRounds(roundData);
      setScores(scoreData);
      if (logData) setLogs(logData);
      setState((current) => ({ ...current, loading: false, error: '' }));
    } catch (error) {
      if (error.message === 'Admin access required' || error.message === 'Authentication required') onLogout();
      else setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  };

  useEffect(() => {
    load({ includeLogs: true });
    const refresh = window.setInterval(() => load({ includeLogs: true }), 15_000);
    const clock = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, []);

  const runAction = async (action, success) => {
    try {
      await action();
      setState({ loading: false, error: '', success });
      await load();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message, success: '' }));
    }
  };

  const changeRound = (round, action, body = {}) => runAction(
    () => apiRequest(`/api/admin/rounds/${round}/${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    `Round ${round} ${({ start: 'started', pause: 'paused', resume: 'resumed', end: 'ended' })[action]}.`,
  );

  const startRound = (round) => {
    const rawDuration = window.prompt('Round duration in seconds (1–86400):', '1800');
    if (rawDuration === null) return;
    const durationSec = Number(rawDuration);
    if (!Number.isInteger(durationSec) || durationSec < 1 || durationSec > 86400) {
      setState((current) => ({ ...current, error: 'Duration must be a whole number from 1 to 86400 seconds.', success: '' }));
      return;
    }
    if (!window.confirm(`Start round ${round} for ${durationSec} seconds?`)) return;
    void changeRound(round, 'start', { durationSec });
  };

  const adjustScore = (team) => {
    const round = window.prompt(`Round number for ${team.teamId}:`);
    if (round === null) return;
    const amount = window.prompt('Adjustment amount (-1000 to 1000):');
    if (amount === null) return;
    const reason = window.prompt('Reason (required, max 200 characters):');
    if (reason === null) return;
    const adjustment = { round: Number(round), amount: Number(amount), reason: reason.trim() };
    if (!Number.isInteger(adjustment.round) || adjustment.round < 1
      || !Number.isInteger(adjustment.amount) || adjustment.amount < -1000 || adjustment.amount > 1000
      || !adjustment.reason || adjustment.reason.length > 200) {
      setState((current) => ({ ...current, error: 'Enter a valid round, adjustment amount, and reason.', success: '' }));
      return;
    }
    if (!window.confirm(`Apply ${adjustment.amount} points to ${team.teamId} in round ${adjustment.round}?\nReason: ${adjustment.reason}`)) return;
    void runAction(
      () => apiRequest(`/api/admin/teams/${team.teamId}/adjust`, {
        method: 'POST',
        body: JSON.stringify(adjustment),
      }),
      `Score adjustment recorded for ${team.teamId}.`,
    );
  };

  const clearLockout = (teamId) => {
    if (!window.confirm(`Clear login lockout for ${teamId}?`)) return;
    void runAction(
      () => apiRequest(`/api/admin/teams/${teamId}/clear-login-lockout`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      `Login lockout cleared for ${teamId}.`,
    );
  };

  const createTeam = async (event) => {
    event.preventDefault();
    setState({ loading: false, error: '', success: '' });
    try {
      const result = await apiRequest('/api/admin/teams', { method: 'POST', body: JSON.stringify({ name: form.name, biasPoints: Number(form.biasPoints) }) });
      setCredentials(result.credentials);
      setForm({ name: '', biasPoints: 0 });
      setState({ loading: false, error: '', success: `${result.team.teamId} created successfully.` });
      await load();
    } catch (error) {
      setState({ loading: false, error: error.message, success: '' });
    }
  };

  const updateTeam = async (teamId, patch) => {
    try {
      await apiRequest(`/api/admin/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setState({ loading: false, error: '', success: `${teamId} updated.` });
      await load();
    } catch (error) {
      setState({ loading: false, error: error.message, success: '' });
    }
  };

  const resetPassword = async (teamId, slot) => {
    if (!window.confirm(`Reset the ${slot} password for ${teamId}?`)) return;
    try {
      const result = await apiRequest(`/api/admin/teams/${teamId}/reset-password`, { method: 'POST', body: JSON.stringify({ slot }) });
      setCredentials({ [slot]: result.password });
      setState({ loading: false, error: '', success: `${teamId} ${slot} password reset.` });
    } catch (error) {
      setState({ loading: false, error: error.message, success: '' });
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      onLogout();
    }
  };

  if (state.loading && !teams.length) return <LoadingState label="Loading admin control center…" />;
  if (state.error && !teams.length) return <ErrorState message={state.error} onRetry={load} />;
  const scoresByTeam = new Map(scores.map((score) => [score.teamId, score.total]));
  const nextRoundNumber = rounds.reduce((next, round) => Math.max(next, round.round + 1), 1);
  const displayedRounds = [...rounds, { round: nextRoundNumber, status: 'not_started', deadline: null, pausedAt: null }];
  return <main className="product-page admin-dashboard">
    <div className="product-heading"><div><p className="product-eyebrow">CONTROL CENTER / ADMIN</p><h1>Event operations</h1><p className="product-subtitle">Manage teams, rounds and audit activity.</p></div><button className="product-btn product-btn--light" onClick={logout}>Log out</button></div>
    <FormMessage error={state.error} success={state.success} />
    <section className="product-section">
      <div className="product-section-heading"><p className="product-eyebrow">ROUND CONTROL</p><h2>Rounds</h2></div>
      <div className="cc-admin-round-grid">
        {displayedRounds.map((round) => {
          const deadline = round.deadline ? new Date(round.deadline).getTime() : null;
          const pausedAt = round.pausedAt ? new Date(round.pausedAt).getTime() : null;
          const remainingMs = deadline === null
            ? null
            : Math.max(0, deadline - (round.status === 'paused' && pausedAt !== null ? pausedAt : clockNow));
          return <article className="product-panel cc-admin-round" key={round.round}>
            <div className="cc-admin-round__heading"><span className="product-mono">ROUND {String(round.round).padStart(2, '0')}</span><span className={`cc-round-status cc-round-status--${round.status}`}>{round.status.replaceAll('_', ' ')}</span></div>
            <dl>
              <div><dt>Deadline</dt><dd>{deadline === null ? 'Not scheduled' : new Date(deadline).toLocaleString()}</dd></div>
              <div><dt>Time remaining</dt><dd>{formatDuration(remainingMs)}</dd></div>
            </dl>
            <div className="cc-admin-round__actions">
              <button className="product-btn product-btn--small product-btn--primary" disabled={round.status !== 'not_started'} onClick={() => startRound(round.round)}>Start</button>
              <button className="product-btn product-btn--small product-btn--light" disabled={round.status !== 'running'} onClick={() => void changeRound(round.round, 'pause')}>Pause</button>
              <button className="product-btn product-btn--small product-btn--light" disabled={round.status !== 'paused'} onClick={() => void changeRound(round.round, 'resume')}>Resume</button>
              <button className="product-btn product-btn--small product-btn--light" disabled={!['running', 'paused'].includes(round.status)} onClick={() => {
                if (window.confirm(`End round ${round.round}? This cannot be undone.`)) void changeRound(round.round, 'end');
              }}>End</button>
            </div>
          </article>;
        })}
      </div>
    </section>
    <section className="product-section"><div className="product-section-heading"><p className="product-eyebrow">NEW TEAM</p><h2>Create team</h2></div><form className="admin-create-form" onSubmit={createTeam}><Field label="TEAM NAME"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="BIAS POINTS"><input type="number" value={form.biasPoints} onChange={(event) => setForm({ ...form, biasPoints: event.target.value })} /></Field><button className="product-btn product-btn--primary">Create team</button></form><CredentialBox credentials={credentials} /></section>
    <section className="product-section"><div className="product-section-heading"><p className="product-eyebrow">ACCESS CONTROL / LIVE LEDGER TOTALS</p><h2>Teams</h2></div><div className="table-wrap"><table className="product-table cc-admin-team-table"><thead><tr><th>Team ID</th><th>Name</th><th>Bias Points</th><th>Active</th><th>P1 online</th><th>P2 online</th><th>Total score</th><th>Actions</th></tr></thead><tbody>{teams.map((team) => <tr key={team.teamId}><td className="product-mono">{team.teamId}</td><td><input className="table-input cc-team-name-input" value={edits[`${team.teamId}:name`] ?? team.name} onChange={(event) => setEdits({ ...edits, [`${team.teamId}:name`]: event.target.value })} /><button className="table-action" onClick={() => updateTeam(team.teamId, { name: edits[`${team.teamId}:name`] ?? team.name })}>Save name</button></td><td><input className="table-input" type="number" value={edits[team.teamId] ?? team.biasPoints} onChange={(event) => setEdits({ ...edits, [team.teamId]: event.target.value })} /><button className="table-action" onClick={() => updateTeam(team.teamId, { biasPoints: Number(edits[team.teamId] ?? team.biasPoints) })}>Save</button></td><td><Status online={team.active} label={team.active ? 'Enabled' : 'Disabled'} /><button className="table-action" onClick={() => { if (window.confirm(`${team.active ? 'Disable' : 'Enable'} ${team.teamId}?`)) void updateTeam(team.teamId, { active: !team.active }); }}>{team.active ? 'Disable' : 'Enable'}</button></td><td><Status online={Boolean(team.players?.find((player) => player.slot === 'P1')?.online)} /></td><td><Status online={Boolean(team.players?.find((player) => player.slot === 'P2')?.online)} /></td><td>{scoresByTeam.get(team.teamId) ?? 0}</td><td><div className="action-stack"><button className="table-action" onClick={() => adjustScore(team)}>Adjust score</button>{['P1', 'P2'].map((slot) => <button className="table-action" key={slot} onClick={() => resetPassword(team.teamId, slot)}>Reset {slot} password</button>)}<button className="table-action" onClick={() => clearLockout(team.teamId)}>Clear lockout</button></div></td></tr>)}</tbody></table></div></section>
    <section className="product-section"><div className="product-section-heading"><p className="product-eyebrow">AUDIT TRAIL / REFRESHES EVERY 15 SECONDS</p><h2>Recent logs</h2></div><div className="table-wrap"><table className="product-table logs-table"><thead><tr><th>Time</th><th>Type</th><th>Actor type</th><th>Team</th></tr></thead><tbody>{logs.map((log) => <tr key={log._id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.type}</td><td>{log.actorType}</td><td>{log.teamId || '—'}</td></tr>)}</tbody></table></div></section>
  </main>;
}

function NotFound() {
  return <main className="product-page"><div className="product-panel state-panel"><p className="product-eyebrow">404 / SIGNAL LOST</p><h1>That route does not exist.</h1><a className="product-btn product-btn--primary" href="/">Return home</a></div></main>;
}

function Practice({ onClose }) { const [answer, setAnswer] = useState(''); const [result, setResult] = useState(''); return <div className="modal-backdrop" onClick={onClose}><section className="modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close practice sample">×</button><p className="eyebrow">PRACTICE SAMPLE / ROUND 01</p><h2>Phish or Legit?</h2><p>Is this message asking you to act in a trustworthy way?</p><div className="message-card"><span>FROM: campus-it@helpdesk.example</span><strong>Your account will be deleted in 10 minutes. Verify now.</strong><span>→ https://campus-help.example/verify</span></div><div className="choice-row"><button onClick={() => { setAnswer('PHISH'); setResult('Correct. Urgency + an unfamiliar link are useful clues.'); }}>Phish</button><button onClick={() => { setAnswer('LEGIT'); setResult('Not quite. Look for urgency and the unfamiliar destination.'); }}>Legit</button></div>{answer && <p className="feedback" role="status"><b>{answer}</b> / {result}</p>}</section></div> }

function Portal({ team, setTeam, completed, score, unlock, completeRound }) { const [active, setActive] = useState(0); const round = rounds[active]; return <main className="portal-page"><div className="portal-header"><div><p className="eyebrow">PARTICIPANT PORTAL / TEAM VIEW</p><h1>Welcome, <span>{team.name}.</span></h1><p>Keep moving. Your next challenge appears when the last one is submitted.</p></div><div className="team-edit"><label>TEAM NAME<input value={team.name} onChange={(event) => setTeam({ ...team, name: event.target.value })} /></label><label>MEMBERS<select value={team.members} onChange={(event) => setTeam({ ...team, members: Number(event.target.value) })}><option value="2">2 members</option><option value="3">3 members</option></select></label></div></div><div className="progress-strip">{rounds.map((item, index) => <button key={item.number} className={`${active === index ? 'selected ' : ''}${completed[index] ? 'done ' : ''}${unlock(index) ? '' : 'locked'}`} disabled={!unlock(index)} onClick={() => setActive(index)}><span>{completed[index] ? '✓' : item.number}</span>{item.title}</button>)}</div><div className="portal-grid"><section className="challenge-panel"><div className="panel-top"><div><p className="label">ROUND {round.number} / {round.time}</p><h2>{round.title}</h2><p className="subtitle">{round.subtitle}</p></div><span className={unlock(active) ? 'access open' : 'access'}>{unlock(active) ? 'UNLOCKED' : 'LOCKED'}</span></div>{unlock(active) ? <Challenge active={active} complete={() => completeRound(active, active === 0 ? 25 : 50)} /> : <div className="locked-state"><div className="lock-mark">{String(active).padStart(2, '0')}</div><h3>Complete Round {String(active).padStart(2, '0')} first.</h3><p>The challenge path is sequential. Submit the previous round to unlock this workspace.</p></div>}</section><aside className="score-panel"><p className="eyebrow">TEAM STATUS</p><div className="big-score">{score.reduce((total, item) => total + item, 0)}<span>/ 175</span></div><p className="muted">TOTAL POINTS</p><div className="score-list">{rounds.map((item, index) => <div key={item.number}><span>{item.number} {item.title}</span><strong>{score[index] || '—'}</strong></div>)}</div><div className="next-up"><span>NEXT UP</span><b>{rounds.find((_, index) => !completed[index])?.title || 'All rounds complete'}</b></div></aside></div></main> }

function Challenge({ active, complete }) { const [input, setInput] = useState(''); const [selected, setSelected] = useState(''); if (active === 0) return <div className="challenge-content"><p className="challenge-intro">Three fast decisions. This is a practice workspace: your demo result is not saved to a live scoreboard.</p><div className="mini-game"><p className="label">PACKET SORT / 01</p><h3>Which signal deserves a closer look?</h3><div className="signal-options">{['A login from a new device', 'A password reset at 03:14', 'A calendar invite from a friend'].map((option) => <button className={selected === option ? 'chosen' : ''} key={option} onClick={() => setSelected(option)}>{option}<span>↗</span></button>)}</div><button className="button primary" disabled={!selected} onClick={complete}>Submit answer <span>↗</span></button></div></div>; if (active === 1) return <div className="challenge-content"><p className="challenge-intro">A safe mock website is loaded below. In the real round, inspect the page source and DOM for the flag.</p><div className="mock-browser"><div className="browser-bar"><span>○ ○ ○</span><code>local.challenge / vault</code></div><div className="mock-site"><p className="label">CAMPUS DIGITAL ARCHIVE</p><h3>Welcome to the vault.</h3><p>Some things are easier to find when you inspect the obvious.</p><div className="hidden-field">PASSWORD: <span>••••••••</span></div><button onClick={() => setInput('CC{DOM_FOUND_204}')} className="text-button">Reveal inspected flag ↗</button></div></div><label className="answer-field">SUBMIT DISCOVERED FLAG<input value={input} onChange={(event) => setInput(event.target.value)} placeholder="CC{...}" /></label><button className="button primary" disabled={!input} onClick={complete}>Submit flag <span>↗</span></button></div>; if (active === 2) return <div className="challenge-content"><p className="challenge-intro">Download the dossier, search the evidence, and identify the key that connects the timestamps.</p><div className="dossier"><span className="file-type">TXT</span><div><b>case_07_dossier.zip</b><p>4 files / 1.8 MB / raw evidence</p></div><button className="text-button">View dossier ↓</button></div><label className="answer-field">EXTRACTED DATA KEY<input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter the key you found" /></label><button className="button primary" disabled={!input} onClick={complete}>Submit key <span>↗</span></button></div>; return <div className="challenge-content"><p className="challenge-intro">The Vault Guard protects one master key. Ask carefully. It will answer, but only if your strategy is sound.</p><div className="chat-box"><div className="guard-message"><span>VAULT GUARD / ONLINE</span><p>I can help with general security questions. I cannot reveal protected access codes.</p></div>{input && <div className="user-message">{input}</div>}</div><label className="answer-field">PROMPT THE VAULT GUARD<textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the guard something..." /></label><button className="button primary" disabled={!input} onClick={complete}>Send prompt <span>↗</span></button></div> }

function Admin({ completed, manual, setManual, score, eventLive, setEventLive }) { return <main className="admin-page"><div className="portal-header"><div><p className="eyebrow">CONTROL CENTER / ADMIN</p><h1>Event <span>control.</span></h1><p>Manage access, monitor progress, and verify the signal.</p></div><button className={`button ${eventLive ? 'danger' : 'primary'}`} onClick={() => setEventLive(!eventLive)}>{eventLive ? 'Pause event' : 'Start event'} <span>↗</span></button></div><section className="admin-grid"><div className="admin-card"><div className="card-title"><p className="eyebrow">ROUND CONTROL</p><span>{completed.filter(Boolean).length} / 4 complete</span></div>{rounds.map((round, index) => <div className="control-row" key={round.number}><div className="round-number small">{round.number}</div><div><b>{round.title}</b><p>{round.time} / {round.mode}</p></div><button className={`toggle ${manual[index] ? 'on' : ''}`} onClick={() => setManual(manual.map((value, i) => i === index ? !value : value))} aria-label={`${manual[index] ? 'Lock' : 'Unlock'} ${round.title}`}><span /></button></div>)}</div><div className="admin-card"><div className="card-title"><p className="eyebrow">LIVE LEADERBOARD</p><span>{eventLive ? 'UPDATING' : 'NOT STARTED'}</span></div><div className="leader-row header"><span>TEAM</span><span>R1</span><span>R2</span><span>R3</span><span>R4</span><span>TOTAL</span></div><div className="leader-row"><b>Packet Picnic</b><span>{score[0] || '—'}</span><span>{score[1] || '—'}</span><span>{score[2] || '—'}</span><span>{score[3] || '—'}</span><strong>{score.reduce((a, b) => a + b, 0) || '—'}</strong></div><div className="leader-empty">Scores appear here as teams submit verified answers.</div></div></section><section className="verification"><p className="eyebrow">SUBMISSION VERIFICATION</p><h2>Review queue <span>·</span> clear</h2><p>No pending flags or dossier keys require manual review. Automated scoring is ready for Round 02 and Round 03.</p></section></main> }

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);

(function () {
  function init() {
    const nav = document.querySelector('.cc-sb__nav');
    if (!nav) {
      return;
    }

    const sidebar = nav.closest('.cc-sb');
    const indicator = nav.querySelector('.cc-sb__indicator');
    const links = Array.from(nav.querySelectorAll('.cc-sb__link'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = null;
    let lockUntil = 0;

    if (sidebar) {
      const cs = getComputedStyle(sidebar);
      nav.style.marginLeft = '-' + cs.paddingLeft;
      nav.style.marginRight = '-' + cs.paddingRight;
    }

    const targets = links
      .map(function (l) {
        const id = (l.getAttribute('href') || '').replace('#', '');
        return { link: l, el: id ? document.getElementById(id) : null };
      })
      .filter(function (t) { return t.el; });

    if (!targets.length) {
      console.warn('[cc-sb] No sections found for the sidebar links. Check the href values and section ids.');
      return;
    }

    function setActive(link) {
      if (!link || link === current) return;
      current = link;
      links.forEach(function (l) {
        const on = l === link;
        l.classList.toggle('is-active', on);
        if (on) l.setAttribute('aria-current', 'location');
        else l.removeAttribute('aria-current');
      });
      indicator.style.transform = 'translateY(' + link.offsetTop + 'px)';
      indicator.style.setProperty('--cc-bubble', link.dataset.accent || '#00c8eb');
    }

    function update() {
      if (Date.now() < lockUntil) return;
      const line = window.innerHeight * 0.35;
      let best = targets[0];
      targets.forEach(function (t) {
        if (t.el.getBoundingClientRect().top <= line) best = t;
      });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) best = targets[targets.length - 1];
      setActive(best.link);
    }

    setActive(links[0]);
    setTimeout(function () {
      nav.classList.add('is-ready');
      update();
    });

    // capture:true also catches scroll events from inner scroll containers, not just the window
    document.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);

    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        const t = targets.find(function (x) { return x.link === link; });
        if (!t) return;
        e.preventDefault();
        lockUntil = Date.now() + 800;
        setActive(link);
        t.el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', link.getAttribute('href'));
        setTimeout(update, 850);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 0);
    });
  } else {
    setTimeout(init, 0);
  }
})();

/* === TOP NAV + PAGE NETWORK (delete this block to remove) === */
(function () {
  function initNav() {
    const nav = document.querySelector('.cc-top__nav');
    if (!nav) { setTimeout(initNav, 0); return; }
    const pill = nav.querySelector('.cc-top__pill');
    const links = Array.from(nav.querySelectorAll('.cc-top__link'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = null, lockUntil = 0;
    const targets = links.map(function (l) {
      const id = (l.getAttribute('href') || '').replace('#', '');
      return { link: l, el: id ? document.getElementById(id) : null };
    }).filter(function (t) { return t.el; });
    if (!targets.length) { console.warn('[cc-top] no sections found for nav links'); return; }
    function place(link) {
      pill.style.width = link.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + link.offsetLeft + 'px)';
      const c = link.dataset.accent || '#00c8e9';
      pill.style.backgroundColor = c;
      pill.style.boxShadow = '0 0 18px ' + c + '73';
    }
    function setActive(link) {
      if (!link || link === current) return;
      current = link;
      links.forEach(function (l) {
        const on = l === link;
        l.classList.toggle('is-active', on);
        if (on) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current');
      });
      place(link);
    }
    function update() {
      if (Date.now() < lockUntil) return;
      const line = window.innerHeight * 0.2;
      let best = targets[0];
      targets.forEach(function (t) { if (t.el.getBoundingClientRect().top <= line) best = t; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) best = targets[targets.length - 1];
      setActive(best.link);
    }
    setActive(links[0]);
    requestAnimationFrame(function () { nav.classList.add('is-ready'); update(); });
    document.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', function () { if (current) place(current); update(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (current) place(current); });
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        const t = targets.find(function (x) { return x.link === link; });
        if (!t) return;
        e.preventDefault();
        lockUntil = Date.now() + 800;
        setActive(link);
        t.el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', link.getAttribute('href'));
        setTimeout(update, 850);
      });
    });
  }

  function initNetwork() {
    if (document.querySelector('.cc-bgnet')) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'cc-bgnet';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    const DENSITY = 8667;
    const LINK_DIST = 125;
    const SPEED = 0.2;
    const COLORS = ['255,255,255', '255,255,255', '163,163,173'];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dots = [], mouse = null;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(30, Math.round((w * h) / DENSITY));
      dots = Array.from({ length: count }, function () {
        const z = 0.3 + Math.random() * 0.7, a = Math.random() * Math.PI * 2;
        return { x: Math.random() * w, y: Math.random() * h, vx: Math.cos(a) * SPEED * z, vy: Math.sin(a) * SPEED * z, z: z, r: 1 + z * 1.6, c: COLORS[(Math.random() * COLORS.length) | 0] };
      });
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) { ctx.strokeStyle = 'rgba(' + a.c + ',' + (1 - d / LINK_DIST) * 0.45 * Math.min(a.z, b.z) + ')'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        if (mouse) {
          const dx = a.x - mouse.x, dy = a.y - mouse.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST * 1.4) { ctx.strokeStyle = 'rgba(255,255,255,' + (1 - d / (LINK_DIST * 1.4)) * 0.55 + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
        }
      }
      dots.forEach(function (p) {
        if (p.z < 0.55) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, 'rgba(' + p.c + ',0.35)'); g.addColorStop(1, 'rgba(' + p.c + ',0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
        } else { ctx.fillStyle = 'rgba(' + p.c + ',' + (0.5 + p.z * 0.5) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      });
    }
    function move() {
      dots.forEach(function (p) { p.x += p.vx; p.y += p.vy; if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10; if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10; });
    }
    function loop() { requestAnimationFrame(loop); move(); draw(); }
    resize();
    if (reduceMotion) draw(); else requestAnimationFrame(loop);
    window.addEventListener('resize', function () { resize(); if (reduceMotion) draw(); });
    window.addEventListener('mousemove', function (e) { mouse = { x: e.clientX, y: e.clientY }; });
    document.addEventListener('mouseleave', function () { mouse = null; });
  }
  function init() { initNav(); initNetwork(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
/* === END TOP NAV + PAGE NETWORK === */

/* === PODIUM LEADERBOARD ANIMATION === */
(function () {
  const podium = document.querySelector('.cc-podium');
  if (!podium || !('IntersectionObserver' in window)) return;
  podium.classList.add('cc-anim');
  new IntersectionObserver(function (entries, observer) {
    if (entries[0].isIntersecting) {
      podium.classList.add('is-in');
      observer.disconnect();
    }
  }, { threshold: 0.3 }).observe(podium);
})();
