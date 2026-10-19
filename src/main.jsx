import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { formatUpdatedAgo, useVisibleClock, useVisiblePolling } from './useVisiblePolling.js';
import { applyCircuitInput, getCircuitPublicState, replayCircuit } from '../shared/circuit.js';
import { buildCircuitSchematic } from './circuitSchematicLayout.js';
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

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
        <a className="cc-top__cta" href="/login" onClick={(event) => { event.preventDefault(); navigate('/login'); }}>Login <span aria-hidden="true">↗</span></a>
      </header>}
      <div className="page-shell">
        {path === '/' && <Landing />}
        {path === '/login' && <Login onSuccess={() => navigate('/dashboard')} />}
        {path === '/dashboard' && <Dashboard onLogout={() => navigate('/login')} />}
        {path === '/dashboard/circuit-sync' && <CircuitSyncGame onBack={() => navigate('/dashboard')} onLogout={() => navigate('/login')} />}
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
        <a className="cc-btn cc-btn--solid" href="/login">Login <span aria-hidden="true">↗</span></a>
        <a className="cc-btn cc-btn--ghost" href="#rounds">Explore the rounds <span aria-hidden="true">↓</span></a>
      </div>
    </section>
    <section className="cc-rounds" id="rounds">
      <dl className="cc-facts">
        <div className="cc-fact"><dt>Format</dt><dd>4-round tournament</dd></div>
        <div className="cc-fact"><dt>Team format</dt><dd>2 players · 1 shared screen</dd></div>
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

      <a className="cc-btn cc-btn--ghost cc-board__cta" href="/login">Login <span aria-hidden="true">↗</span></a>
    </section>
    <footer><span>CYPHERCLASH / 2026</span><span>Made for curious beginners.</span></footer>
    {practice && <Practice onClose={() => setPractice(null)} />}
  </main>;
}

function AuthShell({ eyebrow, title, children }) {
  return <main className="product-page cc-login-page">
      <a className="cc-auth-home" href="/">← Back to home</a>
      <section className="product-card auth-card cc-auth-card">
        <p className="product-eyebrow">{eyebrow}</p>
        <h1 className="cc-auth-title">{title}</h1>
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

function AuthFeedback({ error, success }) {
  if (!error && !success) return null;
  return <p
    className={`cc-auth-message ${error ? 'is-error' : 'is-success'}`}
    role={error ? 'alert' : 'status'}
    aria-live={error ? 'assertive' : 'polite'}
  >{error ? 'Unable to sign in. Check your credentials and try again.' : success}</p>;
}

function Login({ onSuccess }) {
  const [form, setForm] = useState({ teamId: '', password: '' });
  const [state, setState] = useState({ loading: false, error: '', success: '' });
  const [showPassword, setShowPassword] = useState(false);

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
    <form className="product-form cc-login-form" onSubmit={submit} aria-busy={state.loading}>
      <Field label="TEAM ID"><input required maxLength={20} value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value.toUpperCase() })} placeholder="CC-001" autoComplete="username" /></Field>
      <div className="cc-password-field">
        <label className="cc-auth-label" htmlFor="team-password">PASSWORD</label>
        <div className="cc-password-input">
          <input id="team-password" required maxLength={128} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" />
          <button type="button" className="cc-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <AuthFeedback error={state.error} success={state.success} />
      <button className="product-btn product-btn--primary" disabled={state.loading}>{state.loading ? 'Signing in…' : 'Enter dashboard'} <span aria-hidden="true">↗</span></button>
    </form>
  </AuthShell>;
}

function AdminLogin({ onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [state, setState] = useState({ loading: false, error: '', success: '' });
  const [showPassword, setShowPassword] = useState(false);

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
    <form className="product-form cc-login-form" onSubmit={submit} aria-busy={state.loading}>
      <Field label="USERNAME"><input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="username" /></Field>
      <div className="cc-password-field">
        <label className="cc-auth-label" htmlFor="admin-password">PASSWORD</label>
        <div className="cc-password-input">
          <input id="admin-password" required type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" />
          <button type="button" className="cc-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      <AuthFeedback error={state.error} success={state.success} />
      <button className="product-btn product-btn--primary" disabled={state.loading}>{state.loading ? 'Signing in…' : 'Open control center'} <span aria-hidden="true">↗</span></button>
    </form>
  </AuthShell>;
}

function Status({ online, label }) {
  return <span className={`product-status ${online ? 'is-online' : ''}`} aria-live="polite"><i />{label || (online ? 'Online' : 'Offline')}</span>;
}

function Dashboard({ onLogout }) {
  const { data, error, updatedAt } = useVisiblePolling(async () => {
    const [team, score] = await Promise.all([
      apiRequest('/api/team/me'),
      apiRequest('/api/team/score'),
    ]);
    return { team, score };
  });
  const clockNow = useVisibleClock();

  useEffect(() => {
    if (error === 'Authentication required') onLogout();
  }, [error, onLogout]);

  const retry = () => window.location.reload();

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      onLogout();
    }
  };

  if (!data && !error) return <LoadingState label="Loading team dashboard…" />;
  if (!data) return <ErrorState message={error} onRetry={retry} />;
  const round = data.team.currentRound;
  const roundDeadline = round?.deadline ? new Date(round.deadline).getTime() : null;
  const pausedAt = round?.pausedAt ? new Date(round.pausedAt).getTime() : null;
  const remainingMs = roundDeadline === null
    ? null
    : Math.max(0, roundDeadline - (round.status === 'paused' && pausedAt !== null ? pausedAt : clockNow));
  const scores = data.score?.rounds || {};
  const roundOneRunning = round?.round === 1 && round.status === 'running';
  const circuitCompleted = Object.hasOwn(scores, '1');
  return <main className="product-page dashboard-page cc-dashboard">
    <header className="cc-dashboard-header">
      <div>
        <p className="product-eyebrow">PARTICIPANT PORTAL / TEAM DASHBOARD</p>
        <h1>{data.team.name}</h1>
        <div className="cc-dashboard-identity">
          <span>Team ID <strong>{data.team.teamId}</strong></span>
          <span>Bias points <strong>{data.team.biasPoints}</strong></span>
          <Status online={data.team.online} />
        </div>
      </div>
      <button className="product-btn product-btn--light" onClick={logout}>Log out</button>
    </header>
    <div className="cc-poll-status" aria-live="polite">
      <span>{formatUpdatedAgo(updatedAt, clockNow)}</span>
      {error && <strong role="status">Offline — unable to refresh live data. {error}</strong>}
    </div>
    <section className="cc-dashboard-overview" aria-label="Team overview">
      <article className="cc-overview-card cc-round-overview">
        <p className="product-eyebrow">ROUND STATUS</p>
        <h2>{round?.round ? `Round ${String(round.round).padStart(2, '0')}` : 'No round started'}</h2>
        <div className="cc-round-overview__status">
          <span className={`cc-round-status cc-round-status--${round?.status || 'not_started'}`} aria-live="polite">{round?.status === 'paused' ? 'PAUSED' : (round?.status || 'not started').replaceAll('_', ' ')}</span>
        </div>
        <strong className="cc-round-overview__timer">{formatDuration(remainingMs)}</strong>
        <p>{round?.status === 'running' && round.round === 1
          ? 'Round 1 is live. Choose an available game below.'
          : round?.status === 'running'
            ? 'Play together on this shared screen and keyboard.'
            : round?.status === 'paused'
              ? 'Play is paused. Your remaining time is frozen.'
              : round?.status === 'ended'
                ? 'This round has ended.'
                : 'The next round has not started yet.'}</p>
      </article>
      <article className="cc-overview-card cc-score-card">
        <p className="product-eyebrow">YOUR SCORE</p>
        <h2>Round breakdown</h2>
        <strong className="cc-score-card__total">{data.score?.total ?? 0}<span> total points</span></strong>
        <div className="cc-score-card__rounds">
          {[1, 2, 3].map((roundNumber) => {
            const roundKey = String(roundNumber);
            const hasScore = Object.hasOwn(scores, roundKey);
            const hasStarted = hasScore || (round?.round != null && (round.round > roundNumber || (round.round === roundNumber && round.status !== 'not_started')));
            return <div key={roundKey}><span>R{roundNumber}</span><strong>{hasScore ? scores[roundKey] : hasStarted ? 0 : '–'}</strong></div>;
          })}
        </div>
      </article>
      <a className="cc-overview-card cc-rank-card" href="/leaderboard" onClick={(event) => { event.preventDefault(); navigate('/leaderboard'); }}>
        <p className="product-eyebrow">YOUR RANK</p>
        <h2>Live standings</h2>
        <strong>View leaderboard <span aria-hidden="true">↗</span></strong>
        <span className="cc-rank-card__note">Check your place among teams</span>
      </a>
    </section>
    <section className="cc-play-section">
      <div className="cc-play-heading">
        <div><p className="product-eyebrow">ROUND 01 / MINI GAMES</p><h2>Play together</h2></div>
        <span>One shared screen</span>
      </div>
      <div className="cc-play-grid">
        <article className="cc-play-card cc-play-card--violet">
          <div className="cc-play-card__top"><span>01 / LOGIC</span><span className={`cc-game-status cc-game-status--${circuitCompleted ? 'completed' : roundOneRunning ? 'available' : 'locked'}`}>{circuitCompleted ? 'Completed' : roundOneRunning ? 'Available' : 'Locked'}</span></div>
          <h3>Circuit Sync</h3>
          <p>Trace the gates and solve each switch pattern together.</p>
          <button className="cc-play-card__button" disabled={!roundOneRunning || circuitCompleted} onClick={() => navigate('/dashboard/circuit-sync')}>
            {circuitCompleted ? 'Completed' : 'Play Circuit Sync'} <span aria-hidden="true">↗</span>
          </button>
        </article>
        <article className="cc-play-card cc-play-card--coral">
          <div className="cc-play-card__top"><span>02 / CO-OP</span><span className="cc-game-status cc-game-status--locked">Locked</span></div>
          <h3>Dual-Control Maze</h3>
          <p>Coordinate two controls to navigate one shared maze.</p>
          <button className="cc-play-card__button" disabled>Coming soon</button>
        </article>
        <article className="cc-play-card cc-play-card--sky">
          <div className="cc-play-card__top"><span>03 / REFLEX</span><span className="cc-game-status cc-game-status--locked">Locked</span></div>
          <h3>Cyber Runner</h3>
          <p>Work in sync to dodge obstacles and collect points.</p>
          <button className="cc-play-card__button" disabled>Coming soon</button>
        </article>
      </div>
    </section>
    <section className="cc-presence-card">
      <div><p className="product-eyebrow">TEAM PRESENCE</p><h2>Signal crew</h2></div>
      <div><span className="product-mono">ONE TEAM SESSION</span><p>Both players participate together using this screen and keyboard.</p></div>
      <Status online={data.team.online} />
    </section>
  </main>;
}

function LeaderboardScreen({ onBack, onLogout }) {
  const { data: board, error, updatedAt } = useVisiblePolling(() => apiRequest('/api/leaderboard'));
  const now = useVisibleClock();

  useEffect(() => {
    if (error === 'Authentication required') onLogout();
  }, [error, onLogout]);

  const retry = () => window.location.reload();

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      onLogout();
    }
  };

  if (!board && !error) return <LoadingState label="Loading live leaderboard…" />;
  if (!board) return <ErrorState message={error} onRetry={retry} />;
  const topThree = board.rows.slice(0, 3);
  const remainingRows = board.rows.slice(3);
  return <main className="product-page cc-leaderboard-page">
    <div className="product-heading cc-leaderboard-heading">
      <div><p className="product-eyebrow">LIVE EVENT / SCOREBOARD</p><h1>Leaderboard</h1><p className="product-subtitle">Ranked by round points. Bias Points are separate.</p></div>
      <div className="cc-leaderboard-actions">
        <button className="product-btn product-btn--light" onClick={onBack}>Back to dashboard</button>
      </div>
    </div>
    <div className="cc-leaderboard-meta" aria-live="polite">
      <span>{formatUpdatedAgo(updatedAt, now)}</span>
    </div>
    {error && <p className="cc-poll-offline" role="status">Offline — unable to refresh live leaderboard. {error}</p>}
    {!board.rows.length ? <section className="product-panel cc-leaderboard-empty"><p className="product-eyebrow">NO SCORES YET</p><h2>The leaderboard is empty.</h2><p>Active teams and rankings will appear here.</p></section> : <>
      <section className="cc-leaderboard-podium" aria-label="Top three teams">
        {topThree.map((row, index) => <article
          key={`${row.name}-${index}`}
          className={`product-panel cc-leaderboard-podium__card cc-leaderboard-podium__card--${index + 1} ${board.youIndex === index ? 'is-you' : ''}`}
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
              return <tr key={`${row.name}-${absoluteIndex}`} className={isYou ? 'is-you' : ''}>
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

function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return '—:—';
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
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
  const currentPauseMs = round.status === 'paused' && round.pausedAt
    ? Math.max(0, now + serverOffsetMs - new Date(round.pausedAt).getTime())
    : 0;
  return Math.max(0, now + serverOffsetMs - startedAtMs - completedPausesMs - currentPauseMs);
}

function CircuitSyncGame({ onBack, onLogout }) {
  const { data: teamData, error: pollingError, updatedAt } = useVisiblePolling(() => apiRequest('/api/team/me'));
  const now = useVisibleClock();
  const [game, setGame] = useState(null);
  const [inputs, setInputs] = useState([]);
  const [startState, setStartState] = useState({ loading: true, error: '' });
  const [finishState, setFinishState] = useState({ loading: false, error: '', points: null });
  const [inputMessage, setInputMessage] = useState('');
  const serverOffsetRef = useRef(0);
  const finishAttemptedRef = useRef(false);
  const inputLogRef = useRef([]);

  useEffect(() => {
    if (pollingError === 'Authentication required') onLogout();
  }, [pollingError, onLogout]);

  useEffect(() => {
    if (!teamData?.teamId) return undefined;
    let active = true;
    const start = async () => {
      try {
        const result = await apiRequest('/api/games/circuit/start', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        if (!active) return;
        serverOffsetRef.current = new Date(result.serverNow).getTime() - Date.now();
        const key = circuitStorageKey(teamData.teamId, result.startedAt);
        const saved = window.localStorage.getItem(key);
        const savedInputs = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(savedInputs)) throw new Error('Saved Circuit Sync input log is invalid');
        replayCircuit(result.seed, savedInputs);
        inputLogRef.current = savedInputs;
        setInputs(savedInputs);
        setGame({ ...result, key });
        setStartState({ loading: false, error: '' });
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
  let replayError = '';
  if (game) {
    try {
      replayedGame = replayCircuit(game.seed, inputs);
    } catch (error) {
      replayError = error.message;
    }
  }
  const circuitState = replayedGame ? getCircuitPublicState(replayedGame, elapsedMs) : null;

  const finish = async () => {
    if (!game || finishAttemptedRef.current) return;
    finishAttemptedRef.current = true;
    setFinishState({ loading: true, error: '', points: null });
    try {
      const result = await apiRequest('/api/games/circuit/finish', {
        method: 'POST',
        body: JSON.stringify({ inputs: inputLogRef.current }),
      });
      setFinishState({ loading: false, error: '', points: result.points });
      window.localStorage.removeItem(game.key);
    } catch (error) {
      setFinishState({ loading: false, error: error.message, points: null });
    }
  };

  useEffect(() => {
    if (circuitState?.done
      && finishState.points === null
      && !finishState.loading
      && !finishAttemptedRef.current) {
      void finish();
    }
  }, [circuitState?.done, finishState.loading, finishState.points, game]);

  const recordInput = (type, idx) => {
    if (!game || !circuitState || circuitState.done || finishState.loading || finishState.points !== null) return;
    if (round?.status !== 'running') {
      setInputMessage('Inputs are disabled while the round is paused or ended.');
      return;
    }
    const previousTimestamp = inputLogRef.current.at(-1)?.timestamp ?? -80;
    const timestamp = Math.max(0, Math.floor(elapsedMs));
    if (timestamp - previousTimestamp < 80) {
      setInputMessage('Wait a moment before entering the next circuit action.');
      return;
    }
    const input = type === 'toggle' ? { type, idx, timestamp } : { type, timestamp };
    const nextInputs = [...inputLogRef.current, input];
    try {
      replayCircuit(game.seed, nextInputs);
      window.localStorage.setItem(game.key, JSON.stringify(nextInputs));
    } catch (error) {
      setInputMessage(error.message || 'Unable to save Circuit Sync progress on this device.');
      return;
    }
    inputLogRef.current = nextInputs;
    setInputs(nextInputs);
    setInputMessage('');
  };

  useEffect(() => {
    if (!game || !circuitState || circuitState.done) return undefined;
    const onKeyDown = (event) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement
        && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return;
      if (/^[1-6]$/.test(event.key)) {
        const switchIndex = Number(event.key) - 1;
        if (switchIndex < circuitState.switchCount) {
          event.preventDefault();
          recordInput('toggle', switchIndex);
        }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        recordInput('submit');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game, circuitState, round?.status, elapsedMs, finishState]);

  const currentRoundRemaining = round?.deadline
    ? Math.max(0, new Date(round.deadline).getTime() - (
      round.status === 'paused' && round.pausedAt
        ? new Date(round.pausedAt).getTime()
        : now + serverOffsetRef.current
    ))
    : null;
  const canAct = round?.status === 'running' && !finishState.loading && finishState.points === null;

  if (startState.loading) return <LoadingState label="Preparing Circuit Sync…" />;
  if (startState.error) {
    return <main className="product-page cc-circuit-page"><section className="product-panel state-panel">
      <p className="product-eyebrow">CIRCUIT SYNC UNAVAILABLE</p>
      <h1>Could not start the game.</h1>
      <FormMessage error={startState.error} />
      {pollingError && <FormMessage error={pollingError} />}
      <button className="product-btn product-btn--light" onClick={onBack}>Back to dashboard</button>
    </section></main>;
  }
  if (replayError || !circuitState) {
    return <ErrorState message={replayError || 'Circuit Sync state is unavailable'} onRetry={() => window.location.reload()} />;
  }

  return <main className="product-page cc-circuit-page">
    <div className="product-heading cc-circuit-heading">
      <div><p className="product-eyebrow">ROUND 01 / TEAM CIRCUIT PUZZLE</p><h1>Circuit Sync</h1><p className="product-subtitle">One shared screen. Think together, then enter the switch pattern.</p></div>
      <button className="product-btn product-btn--light" onClick={onBack}>Back to dashboard</button>
    </div>
    <div className="cc-poll-status" aria-live="polite">
      <span>{formatUpdatedAgo(updatedAt, now)}</span>
      <span>Round time {formatDuration(currentRoundRemaining)}</span>
      {pollingError && <strong role="status">Offline — unable to refresh round status. {pollingError}</strong>}
    </div>
    {round?.status === 'paused' && <p className="product-message is-error" role="status">Round paused — the puzzle is frozen until play resumes.</p>}
    {round?.status === 'ended' && <p className="product-message is-error" role="status">The round has ended. Your unsubmitted run cannot be scored.</p>}
    {circuitState.done ? <section className="product-panel cc-circuit-finished">
      <p className="product-eyebrow">{finishState.points === null ? 'VERIFYING RUN' : 'GAME COMPLETE'}</p>
      <h2>{finishState.points === null ? 'Checking your circuit log…' : 'Team signal restored.'}</h2>
      {finishState.points !== null && <strong>{finishState.points} POINTS</strong>}
      {finishState.error && <><FormMessage error={finishState.error} /><button className="product-btn product-btn--primary" onClick={() => { finishAttemptedRef.current = false; void finish(); }}>Retry validation</button></>}
      {finishState.points !== null && <button className="product-btn product-btn--light" onClick={onBack}>Return to dashboard</button>}
    </section> : <section className="product-panel cc-circuit-game">
      <div className="cc-circuit-game__meta">
        <span className="product-mono">STAGE {circuitState.stage} / {circuitState.stages}</span>
        <span>MISTAKES {circuitState.wrong} / {circuitState.maxWrong}</span>
        <span>{circuitState.switchCount} SWITCHES</span>
      </div>
      <div className="cc-circuit-cooperation">
        <strong>Two-player solve</strong>
        <span>Player 1 reads the gates and calls the pattern. Player 2 enters it using keys 1–6, then Enter to test. Swap roles between stages if you like.</span>
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
            {circuitState.switches.map((active, index) => <button
              className={`cc-circuit-switch ${active ? 'is-on' : ''}`}
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={`Switch ${index + 1} ${active ? 'on' : 'off'}`}
              disabled={!canAct}
              onClick={() => recordInput('toggle', index)}
              key={index}
            ><span className="cc-circuit-switch__track"><i /></span><span>S{index + 1}<small>{active ? 'ON' : 'OFF'} · KEY {index + 1}</small></span></button>)}
          </div>
          {circuitState.lastFeedback && <p className="cc-circuit-feedback" role="status">{circuitState.lastFeedback.correct} of {circuitState.lastFeedback.of} lamps matched. Check the gate chain and try again.</p>}
          {circuitState.lockedMs > 0 && <p className="cc-circuit-feedback">Next submission in {Math.ceil(circuitState.lockedMs / 1000)}s.</p>}
          <button className="product-btn product-btn--primary" disabled={!canAct || circuitState.lockedMs > 0} onClick={() => recordInput('submit')}>Test circuit <span>· Press Enter</span></button>
        </section>
      </div>
      {inputMessage && <p className="product-message is-error" role="status">{inputMessage}</p>}
      {finishState.error && <FormMessage error={finishState.error} />}
    </section>}
  </main>;
}

function CircuitDiagram({ state }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [pinnedNode, setPinnedNode] = useState(null);
  const layout = buildCircuitSchematic(state);
  const activeNode = hoveredNode || pinnedNode;

  return <div className="cc-circuit-schematic">
    <div className="cc-circuit-diagram" aria-label="Circuit schematic; focus or select a node to trace its wires">
      <svg
        viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.width} ${layout.viewBox.height}`}
        role="group"
        aria-label="Circuit diagram"
      >
        {layout.wires.map((wire) => {
          const related = activeNode && (wire.source === activeNode || wire.target === activeNode);
          return <g className={`cc-circuit-wire-group${activeNode && !related ? ' is-dimmed' : ''}${related ? ' is-highlighted' : ''}`} key={wire.id}>
            <path className="cc-circuit-wire" d={wire.path} />
            <circle className="cc-circuit-port" cx={wire.sourcePoint.x} cy={wire.sourcePoint.y} r="3" />
            <circle className="cc-circuit-port" cx={wire.targetPoint.x} cy={wire.targetPoint.y} r="3" />
          </g>;
        })}
        {layout.nodes.map((node) => {
          const selected = activeNode === node.id;
          const active = node.type === 'switch' && state.switches[node.index];
          const targetLabel = node.type === 'lamp'
            ? `, target ${node.target ? 'on' : 'off'}`
            : '';
          return <g
            className={`cc-circuit-node cc-circuit-node--${node.type}${active ? ' is-on' : ''}${selected ? ' is-selected' : ''}${activeNode && !selected ? ' is-dimmed' : ''}`}
            key={node.id}
            transform={`translate(${node.x} ${node.y})`}
            tabIndex="0"
            role="button"
            aria-label={`${node.id}${node.type === 'gate' ? ` ${node.gate.op} gate` : ''}${targetLabel}`}
            aria-pressed={pinnedNode === node.id}
            onPointerEnter={() => setHoveredNode(node.id)}
            onPointerLeave={() => setHoveredNode(null)}
            onFocus={() => setHoveredNode(node.id)}
            onBlur={() => setHoveredNode(null)}
            onClick={() => setPinnedNode((current) => current === node.id ? null : node.id)}
          >
            {node.type === 'lamp'
              ? <>
                <circle className={`cc-circuit-lamp${node.target ? ' is-on' : ''}`} cx="20" cy={node.height / 2} r="12" />
                <text className="cc-circuit-node-label cc-circuit-lamp-label" x="42" y={node.height / 2 + 4}>
                  {node.id}{node.target === undefined ? '' : ` · ${node.target ? 'ON' : 'OFF'}`}
                </text>
              </>
              : <>
                <rect className="cc-circuit-node-box" x="0" y="0" width={node.width} height={node.height} rx="8" />
                <text className="cc-circuit-node-label" x={node.width / 2} y={node.height / 2 + 4} textAnchor="middle">
                  {node.type === 'gate' ? node.gate.op : node.id}
                </text>
              </>}
          </g>;
        })}
      </svg>
    </div>
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
  return <div className="credential-box"><strong>Team credentials shown once</strong><p>Save the password now. It will not be displayed again.</p><div><span>Team ID <code>{credentials.teamId}</code></span><CopyButton value={credentials.teamId} /></div><div><span>Password <code>{credentials.password}</code></span><CopyButton value={credentials.password} /></div></div>;
}

function AdminDashboard({ onLogout }) {
  const [teams, setTeams] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [scores, setScores] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ name: '', biasPoints: 0 });
  const [credentials, setCredentials] = useState(null);
  const [edits, setEdits] = useState({});
  const clockNow = useVisibleClock();
  const [updatedAt, setUpdatedAt] = useState(null);
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
      setUpdatedAt(Date.now());
      setState((current) => ({ ...current, loading: false, error: '' }));
    } catch (error) {
      if (error.message === 'Admin access required' || error.message === 'Authentication required') onLogout();
      else setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  };

  useEffect(() => {
    let refresh;
    const pollWhileVisible = () => {
      window.clearInterval(refresh);
      refresh = undefined;
      if (document.visibilityState === 'visible') {
        void load({ includeLogs: true });
        refresh = window.setInterval(() => void load({ includeLogs: true }), 25_000);
      }
    };
    document.addEventListener('visibilitychange', pollWhileVisible);
    pollWhileVisible();
    return () => {
      window.clearInterval(refresh);
      document.removeEventListener('visibilitychange', pollWhileVisible);
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

  const startRound = (roundNumber, previousDurationSec, isRestart) => {
    const rawDuration = window.prompt(
      'Round duration in seconds (1–86400):',
      String(previousDurationSec || 1800),
    );
    if (rawDuration === null) return;
    const durationSec = Number(rawDuration);
    if (!Number.isInteger(durationSec) || durationSec < 1 || durationSec > 86400) {
      setState((current) => ({ ...current, error: 'Duration must be a whole number from 1 to 86400 seconds.', success: '' }));
      return;
    }
    const confirmation = isRestart
      ? `Restart round ${roundNumber} for ${durationSec} seconds as a new attempt? Previous results are retained and continue to count toward team totals.`
      : `Start round ${roundNumber} for ${durationSec} seconds?`;
    if (!window.confirm(confirmation)) return;
    void changeRound(roundNumber, 'start', { durationSec });
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
      setCredentials({ teamId: result.team.teamId, password: result.password });
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

  const resetPassword = async (teamId) => {
    if (!window.confirm(`Reset the password for ${teamId}? This will sign the team out.`)) return;
    try {
      const result = await apiRequest(`/api/admin/teams/${teamId}/reset-password`, { method: 'POST', body: JSON.stringify({}) });
      setCredentials({ teamId: result.teamId, password: result.password });
      setState({ loading: false, error: '', success: `${teamId} password reset.` });
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
    <div className="cc-poll-status" aria-live="polite">
      <span>{formatUpdatedAgo(updatedAt, clockNow)}</span>
      {state.error && <strong role="status">Offline — unable to refresh live data. {state.error}</strong>}
    </div>
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
              <button
                className="product-btn product-btn--small product-btn--primary"
                disabled={!['not_started', 'ended'].includes(round.status)}
                onClick={() => startRound(round.round, round.durationSec, round.status === 'ended')}
              >{round.status === 'ended' ? 'Restart' : 'Start'}</button>
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
    <section className="product-section"><div className="product-section-heading"><p className="product-eyebrow">ACCESS CONTROL / LIVE LEDGER TOTALS</p><h2>Teams</h2></div><div className="table-wrap"><table className="product-table cc-admin-team-table"><thead><tr><th>Team ID</th><th>Name</th><th>Bias Points</th><th>Active</th><th>Team online</th><th>Total score</th><th>Actions</th></tr></thead><tbody>{teams.map((team) => <tr key={team.teamId}><td className="product-mono">{team.teamId}</td><td><input className="table-input cc-team-name-input" value={edits[`${team.teamId}:name`] ?? team.name} onChange={(event) => setEdits({ ...edits, [`${team.teamId}:name`]: event.target.value })} /><button className="table-action" onClick={() => updateTeam(team.teamId, { name: edits[`${team.teamId}:name`] ?? team.name })}>Save name</button></td><td><input className="table-input" type="number" value={edits[team.teamId] ?? team.biasPoints} onChange={(event) => setEdits({ ...edits, [team.teamId]: event.target.value })} /><button className="table-action" onClick={() => updateTeam(team.teamId, { biasPoints: Number(edits[team.teamId] ?? team.biasPoints) })}>Save</button></td><td><Status online={team.active} label={team.active ? 'Enabled' : 'Disabled'} /><button className="table-action" onClick={() => { if (window.confirm(`${team.active ? 'Disable' : 'Enable'} ${team.teamId}?`)) void updateTeam(team.teamId, { active: !team.active }); }}>{team.active ? 'Disable' : 'Enable'}</button></td><td><Status online={team.online} /></td><td>{scoresByTeam.get(team.teamId) ?? 0}</td><td><div className="action-stack"><button className="table-action" onClick={() => adjustScore(team)}>Adjust score</button><button className="table-action" onClick={() => resetPassword(team.teamId)}>Reset team password</button><button className="table-action" onClick={() => clearLockout(team.teamId)}>Clear lockout</button></div></td></tr>)}</tbody></table></div></section>
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
