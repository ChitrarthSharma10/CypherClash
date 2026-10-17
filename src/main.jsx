import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import NetworkBg from './NetworkBg';
import './styles.css';

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
      <aside className="side-rail cc-sb">
        <NetworkBg />
        <button className="rail-brand" onClick={() => setView('home')} aria-label="Go to CypherClash home">
          <img src="/club-logo.jpg" alt="Club logo" /><span><strong>CypherClash</strong><strong className="rail-byline">by OsCode</strong></span>
        </button>
        <nav class="cc-sb__nav" aria-label="Event navigation">
  <span class="cc-sb__indicator" aria-hidden="true"><i class="cc-sb__bubble"></i></span>

  <a class="cc-sb__link" href="#event-brief" data-accent="#00c8eb">
    <span class="cc-sb__icon">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    </span>
    <span class="cc-sb__label">Event brief</span>
  </a>

  <a class="cc-sb__link" href="#rounds" data-accent="#00c8eb">
    <span class="cc-sb__icon">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        <line x1="4" y1="22" x2="4" y2="15"/>
      </svg>
    </span>
    <span class="cc-sb__label">Rounds</span>
  </a>

  <a class="cc-sb__link" href="#scoreboard" data-accent="#d4f04a">
    <span class="cc-sb__icon">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-1.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98 1.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
    </span>
    <span class="cc-sb__label">Scoreboard</span>
  </a>
</nav>
      </aside>
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
    <section className="hero content-grid" id="event-brief">
      <div className="hero-copy"><h1>Cypher<span>Clash</span></h1><p className="tagline">Because writing secure code was too much work.</p><p className="intro">A beginner-friendly computer-lab tournament for curious minds, fast teams, and anyone who has ever wondered what happens behind the button.</p><div className="hero-actions"><button className="button primary" onClick={() => setView('portal')}>Enter participant portal <span>↗</span></button><button className="text-button" onClick={() => document.getElementById('rounds').scrollIntoView({ behavior: 'smooth' })}>Explore the rounds ↓</button></div></div>
      <div className="hero-mark"><div className="hero-file"><strong>04</strong><small>ROUNDS IN PLAY</small></div></div>
    </section>
    <section className="facts content-grid"><div><span className="label">FORMAT</span><strong>4-round tournament</strong></div><div><span className="label">TEAM SIZE</span><strong>2–3 members</strong></div><div><span className="label">ENTRY LEVEL</span><strong>Zero prerequisites</strong></div><div><span className="label">WHEN / WHERE</span><strong className="muted">To be announced</strong></div></section>
    <section className="round-section" id="rounds"><div className="section-heading"><p className="eyebrow">THE CHALLENGE MAP</p><h2>Four ways to <span>think sideways.</span></h2><p>Every round rewards a different kind of attention. No security background required.</p></div><div className="round-list">{rounds.map((round, index) => <article className={`round-row ${index === 3 ? 'finale' : ''}`} data-number={round.number} key={round.number}><div className="round-number">{round.number}</div><div className="round-info"><p className="label">{round.mode} <span>/ {round.time}</span></p><h3>{round.title}</h3><p>{round.desc}</p></div><div className="round-focus"><span>SKILL FOCUS</span><strong>{round.focus}</strong>{index === 3 && <b className="finale-tag">FINALE</b>}{index === 0 && <button className="text-button practice-button" onClick={() => setPractice('Phish or Legit?')}>Try a practice sample <span>↗</span></button>}</div></article>)}</div></section>
    <section className="scoreboard content-grid" id="scoreboard"><p className="eyebrow">SCOREBOARD</p><p className="scoreboard-message">Live scoreboard opens when the event starts.</p><button className="text-button" onClick={() => setView('portal')}>Register your team <span>↗</span></button></section>
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
      setTimeout(init, 0);
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

/* === HERO NETWORK BG (delete this block to remove) === */
(function () {
  const PANEL_SELECTOR = '';   // optional: e.g. '.hero-stat'. Leave empty to auto-detect.

  function findPanel() {
    if (PANEL_SELECTOR) return document.querySelector(PANEL_SELECTOR);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (/rounds\s+in\s+play/i.test(node.nodeValue)) {
        let el = node.parentElement;
        while (el && el !== document.body) {
          if (el.offsetWidth >= 300 && el.offsetHeight >= 220) return el;
          el = el.parentElement;
        }
      }
    }
    return null;
  }

  function startHeroNetwork(panel, canvas) {
    const ctx = canvas.getContext('2d');
    const DENSITY = 1500;     // lower = more dots
    const LINK_DIST = 110;    // higher = more connecting lines
    const SPEED = 0.22;       // drift speed
    const COLORS = ['0,200,235', '0,200,235', '0,200,235', '120,170,255', '212,240,74'];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dots = [], mouse = null, rafId = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = panel.clientWidth;
      h = panel.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(24, Math.round((w * h) / DENSITY));
      dots = Array.from({ length: count }, function () {
        const z = 0.3 + Math.random() * 0.7;
        const a = Math.random() * Math.PI * 2;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(a) * SPEED * z,
          vy: Math.sin(a) * SPEED * z,
          z: z,
          r: 1 + z * 1.8,
          c: COLORS[(Math.random() * COLORS.length) | 0]
        };
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            const alpha = (1 - d / LINK_DIST) * 0.5 * Math.min(a.z, b.z);
            ctx.strokeStyle = 'rgba(' + a.c + ',' + alpha + ')';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (mouse) {
          const dx = a.x - mouse.x, dy = a.y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST * 1.4) {
            ctx.strokeStyle = 'rgba(212,240,74,' + (1 - d / (LINK_DIST * 1.4)) * 0.6 + ')';
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
          g.addColorStop(0, 'rgba(' + p.c + ',0.35)');
          g.addColorStop(1, 'rgba(' + p.c + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(' + p.c + ',' + (0.5 + p.z * 0.5) + ')';
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
      rafId = requestAnimationFrame(loop);
      move();
      draw();
    }

    function onMove(e) {
      const r = panel.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onLeave() { mouse = null; }

    resize();
    if (reduceMotion) draw(); else rafId = requestAnimationFrame(loop);

    const ro = new ResizeObserver(function () { resize(); if (reduceMotion) draw(); });
    ro.observe(panel);
    panel.addEventListener('mousemove', onMove);
    panel.addEventListener('mouseleave', onLeave);
  }

  function init(tries) {
    const panel = findPanel();
    if (!panel) {
      if (tries < 10) setTimeout(function () { init(tries + 1); }, 400);
      else console.warn('[hero-net] Panel not found. Set PANEL_SELECTOR.');
      return;
    }
    if (panel.querySelector('.cc-hero-net')) return;

    // only change positioning if the panel isn't already positioned (avoids layout shifts)
    if (getComputedStyle(panel).position === 'static') panel.style.position = 'relative';
    panel.style.isolation = 'isolate';

    // hide the old static decorative SVG network (it is restored if you delete this block)
    panel.querySelectorAll('svg[aria-hidden="true"]').forEach(function (s) {
      s.style.display = 'none';
    });

    const canvas = document.createElement('canvas');
    canvas.className = 'cc-hero-net';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    panel.prepend(canvas);
    startHeroNetwork(panel, canvas);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(0); });
  } else {
    init(0);
  }
})();
/* === END HERO NETWORK BG === */
