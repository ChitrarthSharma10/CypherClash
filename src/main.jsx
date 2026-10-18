import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
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

function App() {
  const [view, setView] = useState('home');
  const [team, setTeam] = useState({ name: 'Packet Picnic', members: 2 });
  const [completed, setCompleted] = useState([false, false, false, false]);
  const [manual, setManual] = useState([true, true, true, true]);
  const [eventLive, setEventLive] = useState(false);
  const [notice, setNotice] = useState('');
  const [score, setScore] = useState([0, 0, 0, 0]);

  const unlock = (index) => manual[index] && (index === 0 || completed[index - 1]);
  const completeRound = (index, points = 25) => {
    setCompleted((current) => current.map((done, i) => i === index ? true : done));
    setScore((current) => current.map((value, i) => i === index ? points : value));
    setNotice(`Round ${String(index + 1).padStart(2, '0')} submitted. Next round unlocked.`);
  };

  return (
    <div className="app-shell">
      <header className="cc-top">
        <nav className="cc-top__nav" aria-label="Event navigation">
          <span className="cc-top__pill" aria-hidden="true"></span>
          <a className="cc-top__link" href="#event-brief" data-accent="#ffc933">Event brief</a>
          <a className="cc-top__link" href="#rounds" data-accent="#22c1f1">Rounds</a>
          <a className="cc-top__link" href="#scoreboard" data-accent="#ff4d5e">Scoreboard</a>
        </nav>
        <a className="cc-top__logo" href="#event-brief">
          <img src="/club-logo.jpg" alt="OsCode club logo" />
        </a>
        <a className="cc-top__cta" href="#scoreboard" onClick={(event) => { event.preventDefault(); setView('portal'); }}>Register your team <span aria-hidden="true">↗</span></a>
      </header>
      <div className="page-shell">
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
        {view === 'home' && <Landing setView={setView} />}
        {view === 'portal' && <Portal team={team} setTeam={setTeam} completed={completed} score={score} unlock={unlock} completeRound={completeRound} />}
        {view === 'admin' && <Admin completed={completed} manual={manual} setManual={setManual} score={score} eventLive={eventLive} setEventLive={setEventLive} />}
      </div>
    </div>
  );
}

function Landing({ setView }) {
  const [practice, setPractice] = useState(null);
  return <main>
    <section className="cc-hero" id="event-brief">
      <p className="cc-hero__presenter">OsCode Presents</p>
      <h1 className="cc-hero__title"><span className="cc-hero__w1">Cypher</span><span className="cc-hero__w2">Clash</span></h1>
      <p className="cc-hero__tag">Because writing secure code was too much work.</p>
      <div className="cc-hero__actions">
        <a className="cc-btn cc-btn--solid" href="#portal" onClick={(event) => { event.preventDefault(); setView('portal'); }}>Enter participant portal <span aria-hidden="true">↗</span></a>
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

      <a className="cc-btn cc-btn--ghost cc-board__cta" href="#portal" onClick={(event) => { event.preventDefault(); setView('portal'); }}>Register your team <span aria-hidden="true">↗</span></a>
    </section>
    <footer><span>CYPHERCLASH / 2026</span><span>Made for curious beginners.</span></footer>
    {practice && <Practice onClose={() => setPractice(null)} />}
  </main>;
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
