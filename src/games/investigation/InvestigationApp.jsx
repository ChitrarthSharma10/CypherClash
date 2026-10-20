import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import ConstellationCanvas from './components/ConstellationCanvas.jsx';
import InvestigationGuidelinesModal from './components/InvestigationGuidelinesModal.jsx';
import ResultsModal from './components/ResultsModal.jsx';

const EVIDENCE_ITEMS = {
  ev1: {
    key: 'ev1',
    id: 'EV-001',
    title: 'Server Room Access Log',
    source: 'Badge Reader Audit',
    detail: 'Badge H-204 opened the archive corridor at 02:11:48.',
    hint: 'Physical security telemetry confirms badge swipe just 74 seconds prior to archive breach.',
  },
  ev2: {
    key: 'ev2',
    id: 'EV-002',
    title: 'Night Technician Statement',
    source: 'Security Debrief Log',
    detail: 'Witness heard the archive electronic door latch release near 02:20.',
    hint: 'Confirms unexpected auxiliary presence in the eastern wing during off-hours maintenance.',
  },
  ev3: {
    key: 'ev3',
    id: 'EV-003',
    title: 'East Corridor CCTV Motion Trace',
    source: 'CCTV Frame 9481',
    detail: 'Motion detected at 02:12:51; face concealed by low-profile hood.',
    hint: 'Proves presence between perimeter ingress and the secure core server bay.',
  },
  ev4: {
    key: 'ev4',
    id: 'EV-004',
    title: 'Decrypted Network Token Payload',
    source: 'Packet Capture #884',
    detail: 'Recovered token: HELIX. Packet accepted at 02:13:02.',
    hint: 'Critical cryptographic proof that matches the internal repository master session key.',
  },
};

const SUSPECTS = [
  {
    name: 'Mara Chen',
    role: 'Lead Research Scientist',
    badge: 'H-204',
    access: 'Level 4 Archives & Bio-Vault',
    alibi: 'Claims to have left campus at 21:00; badge logs indicate otherwise.',
    risk: 'HIGH',
  },
  {
    name: 'Idris Khan',
    role: 'Infrastructure Security Engineer',
    badge: 'SEC-09',
    access: 'Core Routers & SIEM Gateway',
    alibi: 'On-call remote monitoring from home terminal during the incident.',
    risk: 'MEDIUM',
  },
  {
    name: 'Sofia Laurent',
    role: 'Database Administrator',
    badge: 'DB-88',
    access: 'PostgreSQL Relays & Cold Storage',
    alibi: 'Scheduled maintenance script running on database mirror.',
    risk: 'LOW',
  },
  {
    name: 'Evan Walsh',
    role: 'Network Operations Technician',
    badge: 'NET-12',
    access: 'Wiring Closets & Patch Panels',
    alibi: 'Conducting routine fiber checks in the West Engineering building.',
    risk: 'MEDIUM',
  },
];

export default function InvestigationApp({
  teamId = 'CC-001',
  apiUrl,
  onBack,
  onLogout,
}) {
  const apiBase = apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const [role, setRole] = useState(null); // 'detective' | 'analyst' | null
  const [caseState, setCaseState] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [roundStatus, setRoundStatus] = useState('running');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'evidence' | 'forensics' | 'suspects' | 'accusation'
  const [analystInviteCode, setAnalystInviteCode] = useState(() => {
    try {
      return sessionStorage.getItem(`analyst_invite_${teamId}`) || '';
    } catch {
      return '';
    }
  });
  const [inviteInput, setInviteInput] = useState('');
  const [decryptToken, setDecryptToken] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState(null);
  const [remainingTime, setRemainingTime] = useState('—:—');

  // Accusation Form State
  const [accusedSuspect, setAccusedSuspect] = useState('Mara Chen');
  const [accusedEvidence, setAccusedEvidence] = useState('ev1');
  const [accusedReasoning, setAccusedReasoning] = useState('');

  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, type = 'info') => {
    setToastMessage({ msg, type, id: Date.now() });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const parseJsonResponse = async (res) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: text?.slice(0, 120) || `Server returned ${res.status}` };
    }
  };

  // Fetch Case State Helper
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/investigation/state`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        // Not joined yet
        setLoading(false);
        return null;
      }
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        if (data.code === 'ROUND_NOT_STARTED' || data.code === 'ROUND_NOT_RUNNING') {
          setErrorNotice(data.error || 'Round 3 is not currently active');
        }
        setLoading(false);
        return null;
      }
      setCaseState(data.state);
      setRole(data.state?.role || null);
      if (data.deadline) setDeadline(new Date(data.deadline).getTime());
      if (data.roundStatus) setRoundStatus(data.roundStatus);
      setLoading(false);
      return data;
    } catch {
      setLoading(false);
      return null;
    }
  }, [apiBase]);

  // Initial Load & Continuous Polling
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1800);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Case Timer Loop
  useEffect(() => {
    if (!deadline) {
      setRemainingTime('45:00');
      return;
    }
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, deadline - now);
      const totalSec = Math.floor(diff / 1000);
      const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const secs = String(totalSec % 60).padStart(2, '0');
      setRemainingTime(`${mins}:${secs}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  // Claim Detective Role
  const handleJoinDetective = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/api/investigation/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to claim Lead Detective');
      setCaseState(data.state);
      setRole('detective');
      if (data.analystInvite) {
        setAnalystInviteCode(data.analystInvite);
        try {
          sessionStorage.setItem(`analyst_invite_${teamId}`, data.analystInvite);
        } catch {}
      }
      showToast('Lead Detective station claimed! Share the invite with your analyst.', 'success');
      await fetchState();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Claim Analyst Role via Invite
  const handleJoinAnalyst = async () => {
    const code = inviteInput.trim();
    if (!code) {
      showToast('Please enter an analyst invite code', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/api/investigation/join/analyst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invite: code }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Invalid or expired invitation');
      setCaseState(data.state);
      setRole('analyst');
      showToast('Connected as Forensic Analyst! Case workspace unlocked.', 'success');
      await fetchState();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Add Evidence Clue
  const handleAddEvidence = async (key) => {
    try {
      const res = await fetch(`${apiBase}/api/investigation/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to add evidence');
      setCaseState(data.state);
      showToast(`${EVIDENCE_ITEMS[key]?.id || key} committed to shared ledger!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Decrypt Forensic Token
  const handleDecrypt = async (e) => {
    e.preventDefault();
    const token = decryptToken.trim();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/investigation/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Decryption failed: Token rejected');
      setCaseState(data.state);
      setDecryptToken('');
      showToast('Payload decrypted successfully! Evidence EV-004 unsealed.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Submit Accusation
  const handleSubmitAccusation = async (e) => {
    e.preventDefault();
    if (accusedReasoning.trim().length < 20) {
      showToast('Reasoning must be at least 20 characters', 'error');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/investigation/accusation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          suspect: accusedSuspect,
          evidenceKey: accusedEvidence,
          reasoning: accusedReasoning.trim(),
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to submit accusation');
      setCaseState(data.state);
      showToast('Formal accusation filed! Awaiting partner approval.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Approve Accusation
  const handleApproveAccusation = async () => {
    try {
      const res = await fetch(`${apiBase}/api/investigation/accusation/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      setCaseState(data.state);
      setShowResultsModal(true);
      showToast('Accusation approved by both specialists! Case resolved and scored.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const clues = caseState?.clues || [];
  const cluesMap = new Map(clues.map((c) => [c.key, c]));
  const isAgreed = caseState?.accusation?.agreed;
  const isPendingApproval = caseState?.accusation && !isAgreed;
  const canApprove = isPendingApproval && caseState?.accusation?.submittedBy !== role;
  const confidencePercent = Math.min(15 + clues.length * 20 + (caseState?.decrypted ? 15 : 0) + (isAgreed ? 10 : 0), 100);

  return (
    <div className="investigation-shell" style={{ background: '#050d14', color: '#e6f4f8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ConstellationCanvas />

      {/* Top Header */}
      <header className="dual-topbar-controls" style={{ padding: '12px 24px', background: '#0a1620', borderBottom: '1px solid rgba(0, 200, 233, 0.28)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button className="product-btn product-btn--light" onClick={onBack} style={{ padding: '6px 14px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
              ← Dashboard
            </button>
          )}
          <div className="front-brand">
            <span className="front-tag" style={{ color: '#00c8e9', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>ROUND 03 / COLLABORATIVE INVESTIGATION</span>
            <h1 className="front-title" style={{ fontSize: '18px', margin: 0, color: '#ffffff', fontWeight: 800 }}>
              The Ghost Protocol: Incident Investigation
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(0, 200, 233, 0.1)',
              border: '1px solid rgba(0, 200, 233, 0.3)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#00c8e9',
              fontWeight: 700,
            }}>
              TEAM: {teamId}
            </span>
            {role && (
              <span style={{
                background: role === 'detective' ? 'rgba(0, 200, 233, 0.2)' : 'rgba(212, 240, 74, 0.2)',
                border: `1px solid ${role === 'detective' ? '#00c8e9' : '#d4f04a'}`,
                color: role === 'detective' ? '#00c8e9' : '#d4f04a',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
              }}>
                {role === 'detective' ? '⌕ LEAD DETECTIVE' : '⌘ FORENSIC ANALYST'}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '10px', color: '#9fb8c2', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>CASE CLOCK</span>
            <strong style={{ fontSize: '18px', fontFamily: 'monospace', color: remainingTime === '00:00' ? '#ff4d5e' : '#d4f04a' }}>
              {remainingTime}
            </strong>
          </div>
          <button
            className="product-btn"
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              color: '#d4f04a',
              background: 'rgba(212, 240, 74, 0.12)',
              border: '1px solid rgba(212, 240, 74, 0.4)',
              cursor: 'pointer',
            }}
            onClick={() => setShowGuidelines(true)}
          >
            📋 Briefing
          </button>
          {onLogout && (
            <button
              className="product-btn"
              onClick={onLogout}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#9fb8c2',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 2, maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {errorNotice && (
          <div style={{ background: 'rgba(255, 77, 94, 0.15)', border: '1px solid #ff4d5e', padding: '16px', borderRadius: '8px', color: '#ffb3b8' }}>
            <strong>Notice:</strong> {errorNotice}
          </div>
        )}

        {/* NOT JOINED SCREEN: Station Selection */}
        {!role && !loading && (
          <section style={{ background: '#0a1620', border: '1px solid rgba(0, 200, 233, 0.3)', borderRadius: '12px', padding: '32px', textAlign: 'center', maxWidth: '800px', margin: '40px auto' }}>
            <span style={{ color: '#00c8e9', fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>IDENTITY CHECK & STATION CLAIM</span>
            <h2 style={{ fontSize: '26px', margin: '10px 0 16px', fontWeight: 800 }}>Choose Your Investigation Station</h2>
            <p style={{ color: '#9fb8c2', fontSize: '14px', lineHeight: 1.6, maxWidth: '620px', margin: '0 auto 32px' }}>
              Round 3 operates on an authoritative cooperative case structure. The <strong>Lead Detective</strong> joins using the team login and receives a one-time invitation code. The <strong>Forensic Analyst</strong> joins from their device using that invitation.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', textAlign: 'left' }}>
              <div style={{ background: 'rgba(0, 200, 233, 0.05)', border: '1px solid rgba(0, 200, 233, 0.3)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 800 }}>STATION 01 // PRIMARY DEVICE</span>
                  <h3 style={{ fontSize: '18px', margin: '8px 0', color: '#fff' }}>Lead Detective</h3>
                  <p style={{ fontSize: '13px', color: '#9fb8c2', lineHeight: 1.5 }}>
                    Inspects access logs, reviews witness debriefs, manages physical evidence, and coordinates the suspect dossier.
                  </p>
                </div>
                <button
                  onClick={handleJoinDetective}
                  className="product-btn product-btn--primary"
                  style={{ width: '100%', marginTop: '20px', padding: '10px', fontSize: '13px', fontWeight: 800 }}
                >
                  Claim Lead Detective Station ↗
                </button>
              </div>

              <div style={{ background: 'rgba(212, 240, 74, 0.05)', border: '1px solid rgba(212, 240, 74, 0.3)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#d4f04a', fontWeight: 800 }}>STATION 02 // SECOND DEVICE</span>
                  <h3 style={{ fontSize: '18px', margin: '8px 0', color: '#fff' }}>Forensic Analyst</h3>
                  <p style={{ fontSize: '13px', color: '#9fb8c2', lineHeight: 1.5 }}>
                    Analyzes network packet dumps, decrypts intercepted auth payloads, and corroborates digital timestamps.
                  </p>
                  <div style={{ marginTop: '12px' }}>
                    <input
                      type="text"
                      placeholder="Paste 43-character invite code..."
                      value={inviteInput}
                      onChange={(e) => setInviteInput(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', background: '#050d14', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleJoinAnalyst}
                  className="product-btn"
                  style={{ width: '100%', marginTop: '20px', padding: '10px', fontSize: '13px', fontWeight: 800, background: '#d4f04a', color: '#000', border: 0 }}
                >
                  Join via Invitation ↗
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ACTIVE WORKSPACE */}
        {role && caseState && (
          <>
            {/* Top Stat Ribbon & Analyst Invitation Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '14px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', color: '#9fb8c2', fontWeight: 700 }}>EVIDENCE COMMITTED</span>
                <strong style={{ fontSize: '20px', display: 'block', color: '#00c8e9', marginTop: '4px' }}>
                  {clues.length} / 4
                </strong>
              </div>
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '14px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', color: '#9fb8c2', fontWeight: 700 }}>NETWORK DECRYPTION</span>
                <strong style={{ fontSize: '20px', display: 'block', color: caseState.decrypted ? '#d4f04a' : '#ff4d5e', marginTop: '4px' }}>
                  {caseState.decrypted ? 'DECRYPTED ✓' : 'LOCKED ✗'}
                </strong>
              </div>
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '14px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', color: '#9fb8c2', fontWeight: 700 }}>WRONG ATTEMPTS (W)</span>
                <strong style={{ fontSize: '20px', display: 'block', color: (caseState.wrongAttempts || 0) > 0 ? '#ff4d5e' : '#2ecc71', marginTop: '4px' }}>
                  {caseState.wrongAttempts || 0} <span style={{ fontSize: '11px', color: '#9fb8c2' }}>(-{(caseState.wrongAttempts || 0) * 15} pts)</span>
                </strong>
              </div>
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '14px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', color: '#9fb8c2', fontWeight: 700 }}>ROUND 03 SCORE</span>
                <strong style={{ fontSize: '20px', display: 'block', color: isAgreed ? '#2ecc71' : '#00c8e9', marginTop: '4px' }}>
                  {caseState.score || Math.max(150, 500 - (caseState.wrongAttempts || 0) * 15)} PTS
                </strong>
              </div>
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '14px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', color: '#9fb8c2', fontWeight: 700 }}>ACCUSATION STATUS</span>
                <strong style={{ fontSize: '15px', display: 'block', color: isAgreed ? '#d4f04a' : isPendingApproval ? '#00c8e9' : '#9fb8c2', marginTop: '8px' }}>
                  {isAgreed ? 'CASE CLOSED ✓' : isPendingApproval ? 'PENDING APPROVAL ⏳' : 'UNRESOLVED'}
                </strong>
              </div>
            </div>

            {/* Detective Analyst Share Bar */}
            {analystInviteCode && role === 'detective' && (
              <div style={{ background: 'rgba(0, 200, 233, 0.08)', border: '1px solid #00c8e9', padding: '14px 20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#00c8e9', fontSize: '13px' }}>Share with Forensic Analyst:</strong>
                  <span style={{ marginLeft: '10px', fontFamily: 'monospace', fontSize: '13px', background: '#050d14', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(0,200,233,0.3)', color: '#fff' }}>
                    {analystInviteCode}
                  </span>
                </div>
                <button
                  className="product-btn product-btn--small"
                  onClick={() => {
                    navigator.clipboard.writeText(analystInviteCode);
                    showToast('Invite code copied to clipboard!', 'success');
                  }}
                  style={{ background: '#00c8e9', color: '#000', border: 0, fontWeight: 700 }}
                >
                  Copy Invite
                </button>
              </div>
            )}

            {/* Nav Tabs */}
            <nav style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(0,200,233,0.2)', paddingBottom: '12px' }}>
              {[
                { id: 'overview', label: '◈ Case Overview' },
                { id: 'evidence', label: `▧ Evidence Ledger (${clues.length}/4)` },
                { id: 'forensics', label: '⌘ Forensic Terminal' },
                { id: 'suspects', label: '◎ Suspect Dossiers' },
                { id: 'accusation', label: isAgreed ? '⚑ Resolution (Completed)' : '⚑ Final Accusation' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: activeTab === tab.id ? 'rgba(0, 200, 233, 0.15)' : 'transparent',
                    border: `1px solid ${activeTab === tab.id ? '#00c8e9' : 'rgba(255,255,255,0.1)'}`,
                    color: activeTab === tab.id ? '#00c8e9' : '#9fb8c2',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
                <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', borderRadius: '8px', padding: '24px' }}>
                  <span style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 800 }}>MISSION BRIEF // INCIDENT CC-03-017</span>
                  <h3 style={{ fontSize: '20px', margin: '8px 0 14px', fontWeight: 800 }}>The Helix Archive Breach</h3>
                  <p style={{ color: '#9fb8c2', lineHeight: 1.6, fontSize: '14px' }}>
                    At precisely 02:13 UTC, unauthorized telemetry was detected within the secure bio-research archive. The perpetrator utilized an internal access card and an encrypted cryptographic token (HELIX) to gain administrative execution privileges.
                  </p>
                  <p style={{ color: '#9fb8c2', lineHeight: 1.6, fontSize: '14px', marginTop: '10px' }}>
                    <strong>Your Objective:</strong> Gather the 4 pieces of verified evidence, decrypt the captured token in the Forensic Terminal, cross-reference the suspect alibis, and submit a joint accusation with partner approval before the timer expires.
                  </p>

                  <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                    <button onClick={() => setActiveTab('evidence')} className="product-btn product-btn--primary" style={{ padding: '8px 18px', fontSize: '12px' }}>
                      Review Evidence Ledger →
                    </button>
                    <button onClick={() => setActiveTab('forensics')} className="product-btn product-btn--light" style={{ padding: '8px 18px', fontSize: '12px' }}>
                      Open Forensic Terminal →
                    </button>
                  </div>
                </div>

                {/* Activity Feed */}
                <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', borderRadius: '8px', padding: '24px' }}>
                  <span style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 800 }}>INCIDENT ACTIVITY TELEMETRY</span>
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                    {(caseState.activity || []).slice().reverse().map((act, idx) => (
                      <div key={idx} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${act.role === 'detective' ? '#00c8e9' : act.role === 'analyst' ? '#d4f04a' : '#9fb8c2'}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ color: act.role === 'detective' ? '#00c8e9' : '#d4f04a' }}>
                            {act.role === 'detective' ? 'Lead Detective' : act.role === 'analyst' ? 'Forensic Analyst' : 'System'}
                          </strong>
                          <span style={{ color: '#9fb8c2', fontSize: '10px' }}>
                            {new Date(act.at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#e6f4f8' }}>{act.message}</p>
                      </div>
                    ))}
                    {(!caseState.activity || caseState.activity.length === 0) && (
                      <span style={{ color: '#9fb8c2', fontSize: '12px' }}>No actions logged yet.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EVIDENCE LEDGER */}
            {activeTab === 'evidence' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {['ev1', 'ev2', 'ev3', 'ev4'].map((key) => {
                  const item = EVIDENCE_ITEMS[key];
                  const inLedger = cluesMap.has(key);
                  const isDecryptable = key === 'ev4';

                  return (
                    <div
                      key={key}
                      style={{
                        background: inLedger ? 'rgba(0, 200, 233, 0.06)' : '#0a1620',
                        border: `1px solid ${inLedger ? '#00c8e9' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '8px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 800 }}>{item.id} // {item.source}</span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: inLedger ? '#00c8e9' : 'rgba(255,255,255,0.1)',
                            color: inLedger ? '#000' : '#9fb8c2',
                          }}>
                            {inLedger ? 'IN LEDGER ✓' : 'UNCOMMITTED'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '16px', margin: '4px 0 10px', color: '#fff' }}>{item.title}</h4>
                        <p style={{ fontSize: '13px', color: inLedger ? '#e6f4f8' : '#9fb8c2', lineHeight: 1.5 }}>
                          {item.detail}
                        </p>
                        <p style={{ fontSize: '11px', color: '#00c8e9', fontStyle: 'italic', marginTop: '8px' }}>
                          💡 {item.hint}
                        </p>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        {inLedger ? (
                          <span style={{ fontSize: '12px', color: '#00c8e9', fontWeight: 700 }}>
                            ✓ Added by {cluesMap.get(key)?.addedBy === 'detective' ? 'Lead Detective' : 'Forensic Analyst'}
                          </span>
                        ) : isDecryptable ? (
                          <button
                            onClick={() => setActiveTab('forensics')}
                            className="product-btn product-btn--light"
                            style={{ fontSize: '12px', padding: '6px 14px' }}
                          >
                            Go to Terminal to Decrypt →
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddEvidence(key)}
                            className="product-btn product-btn--primary"
                            style={{ fontSize: '12px', padding: '6px 14px' }}
                          >
                            Commit to Case Ledger ＋
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: FORENSIC TERMINAL */}
            {activeTab === 'forensics' && (
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.3)', borderRadius: '8px', padding: '24px' }}>
                <span style={{ fontSize: '11px', color: '#d4f04a', fontWeight: 800 }}>NETWORK INTERCEPTION TERMINAL</span>
                <h3 style={{ fontSize: '20px', margin: '8px 0 14px', fontWeight: 800 }}>Packet #884 Cryptographic Analysis</h3>
                <p style={{ color: '#9fb8c2', fontSize: '13px', lineHeight: 1.6, maxWidth: '750px' }}>
                  Border sniffers captured an encrypted handshake between the rogue terminal and the internal archive. An analyst note recovered from memory registers hints at the research project codename: <strong>HELIX</strong>.
                </p>

                <div style={{ marginTop: '20px', background: '#050d14', border: '1px solid rgba(0,200,233,0.2)', borderRadius: '6px', padding: '16px', fontFamily: 'monospace', fontSize: '12px', color: '#00c8e9' }}>
                  <div>FRAME: 0x2A14 // PROTOCOL: TLSv1.3 // CIPHER: CHACHA20-POLY1305</div>
                  <div>PAYLOAD SHA-256: 3c9b7e...41a0e</div>
                  <div>STATUS: {caseState.decrypted ? 'DECRYPTED — EV-004 COMMITTED' : 'AWAITING KEY DECRYPTION'}</div>
                </div>

                {!caseState.decrypted ? (
                  <form onSubmit={handleDecrypt} style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Enter decryption token (e.g. HELIX)..."
                      value={decryptToken}
                      onChange={(e) => setDecryptToken(e.target.value)}
                      style={{ padding: '10px 14px', background: '#050d14', border: '1px solid rgba(0,200,233,0.4)', borderRadius: '4px', color: '#fff', fontSize: '13px', width: '320px' }}
                    />
                    <button type="submit" className="product-btn" style={{ padding: '10px 20px', background: '#d4f04a', color: '#000', border: 0, fontWeight: 800, fontSize: '13px' }}>
                      Execute Decryption ⚡
                    </button>
                  </form>
                ) : (
                  <div style={{ marginTop: '20px', padding: '12px 16px', background: 'rgba(212, 240, 74, 0.1)', border: '1px solid #d4f04a', borderRadius: '4px', color: '#d4f04a', fontSize: '13px', fontWeight: 700 }}>
                    ✓ Decryption Succeeded. Recovered Token: HELIX. Packet Accepted at 02:13:02. Evidence EV-004 is active in ledger.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: SUSPECT DOSSIERS */}
            {activeTab === 'suspects' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {SUSPECTS.map((suspect) => (
                  <div key={suspect.name} style={{ background: '#0a1620', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '18px', margin: 0, color: '#fff' }}>{suspect.name}</h4>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: suspect.risk === 'HIGH' ? '#ff4d5e' : suspect.risk === 'MEDIUM' ? '#d4f04a' : 'rgba(255,255,255,0.1)',
                        color: suspect.risk === 'HIGH' ? '#fff' : suspect.risk === 'MEDIUM' ? '#000' : '#9fb8c2',
                      }}>
                        {suspect.risk} RISK
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#00c8e9', marginTop: '4px', fontWeight: 700 }}>
                      {suspect.role} · BADGE {suspect.badge}
                    </div>
                    <p style={{ fontSize: '12px', color: '#9fb8c2', marginTop: '10px', lineHeight: 1.5 }}>
                      <strong>Access Scope:</strong> {suspect.access}
                    </p>
                    <p style={{ fontSize: '12px', color: '#e6f4f8', marginTop: '6px', lineHeight: 1.5 }}>
                      <strong>Alibi Claim:</strong> {suspect.alibi}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 5: FINAL ACCUSATION */}
            {activeTab === 'accusation' && (
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.3)', borderRadius: '8px', padding: '28px' }}>
                <span style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 800 }}>CASE RESOLUTION // FORMAL ACCUSATION</span>
                <h3 style={{ fontSize: '20px', margin: '8px 0 16px', fontWeight: 800 }}>Synthesize Evidence & Name the Culprit</h3>

                {/* If already agreed */}
                {isAgreed ? (
                  <div style={{ background: 'rgba(212, 240, 74, 0.08)', border: '1px solid #d4f04a', borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
                    <span style={{ fontSize: '40px' }}>🏆</span>
                    <h4 style={{ fontSize: '24px', margin: '12px 0 6px', color: '#d4f04a', fontWeight: 800 }}>Case Solved & Verified</h4>
                    <p style={{ color: '#e6f4f8', fontSize: '14px', maxWidth: '580px', margin: '0 auto 18px', lineHeight: 1.6 }}>
                      Both Lead Detective and Forensic Analyst reached mutual agreement on the formal indictment against <strong>{caseState.accusation.suspect}</strong> supported by <strong>{EVIDENCE_ITEMS[caseState.accusation.evidenceKey]?.id}</strong>.
                    </p>

                    {/* Official Score Box */}
                    <div style={{
                      background: 'rgba(5, 13, 20, 0.95)',
                      border: '1px solid rgba(0, 200, 233, 0.4)',
                      borderRadius: '10px',
                      padding: '20px 24px',
                      maxWidth: '460px',
                      margin: '0 auto 20px',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#00c8e9', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Official Round 3 Tournament Score
                      </div>
                      <div style={{ fontSize: '46px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                        {caseState.score || Math.max(150, 500 - (caseState.wrongAttempts || 0) * 15)} <span style={{ fontSize: '20px', color: '#00c8e9' }}>PTS</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '10px' }}>
                        Formula: <code>max(150, 500 - 15W)</code> • <strong>{caseState.wrongAttempts || 0}</strong> wrong attempt{caseState.wrongAttempts === 1 ? '' : 's'} (-{(caseState.wrongAttempts || 0) * 15} pts)
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      <button
                        onClick={() => setShowResultsModal(true)}
                        className="product-btn"
                        style={{ background: '#00c8e9', color: '#050d14', border: 0, fontWeight: 800, padding: '10px 24px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }}
                      >
                        View Official Scorecard 📊
                      </button>
                      {onBack && (
                        <button
                          onClick={onBack}
                          className="product-btn"
                          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 700, padding: '10px 20px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }}
                        >
                          Return to Dashboard →
                        </button>
                      )}
                    </div>
                  </div>
                ) : isPendingApproval ? (
                  <div style={{ background: 'rgba(0, 200, 233, 0.08)', border: '1px solid #00c8e9', borderRadius: '8px', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ fontSize: '18px', margin: 0, color: '#fff' }}>Accusation Filed — Awaiting Partner Approval</h4>
                      <span style={{ fontSize: '11px', background: '#00c8e9', color: '#000', padding: '3px 8px', borderRadius: '4px', fontWeight: 800 }}>
                        SUBMITTED BY {caseState.accusation.submittedBy.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#e6f4f8' }}>
                      <p><strong>Accused Suspect:</strong> {caseState.accusation.suspect}</p>
                      <p><strong>Key Evidence:</strong> {EVIDENCE_ITEMS[caseState.accusation.evidenceKey]?.id} — {EVIDENCE_ITEMS[caseState.accusation.evidenceKey]?.title}</p>
                      <p><strong>Reasoning:</strong> {caseState.accusation.reasoning}</p>
                    </div>

                    {canApprove ? (
                      <div style={{ marginTop: '20px' }}>
                        <button
                          onClick={handleApproveAccusation}
                          className="product-btn"
                          style={{ background: '#d4f04a', color: '#000', border: 0, fontWeight: 800, padding: '10px 24px', fontSize: '14px', cursor: 'pointer' }}
                        >
                          Approve Accusation & Close Case ✓
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: '16px', color: '#9fb8c2', fontSize: '13px', fontStyle: 'italic' }}>
                        Waiting for your partner ({caseState.accusation.submittedBy === 'detective' ? 'Forensic Analyst' : 'Lead Detective'}) to review and approve this filing.
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSubmitAccusation} style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '640px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 700, display: 'block', marginBottom: '6px' }}>NAME SUSPECT</label>
                      <select
                        value={accusedSuspect}
                        onChange={(e) => setAccusedSuspect(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', background: '#050d14', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '13px' }}
                      >
                        {SUSPECTS.map((s) => (
                          <option key={s.name} value={s.name}>{s.name} ({s.role})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 700, display: 'block', marginBottom: '6px' }}>SUPPORTING EVIDENCE KEY</label>
                      <select
                        value={accusedEvidence}
                        onChange={(e) => setAccusedEvidence(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', background: '#050d14', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '13px' }}
                      >
                        {['ev1', 'ev2', 'ev3', 'ev4'].map((k) => (
                          <option key={k} value={k} disabled={!cluesMap.has(k)}>
                            {EVIDENCE_ITEMS[k]?.id} — {EVIDENCE_ITEMS[k]?.title} {!cluesMap.has(k) ? '(Not yet in ledger)' : '✓'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 700, display: 'block', marginBottom: '6px' }}>CASE REASONING & TIMELINE CORROBORATION (Min 20 chars)</label>
                      <textarea
                        rows={4}
                        placeholder="Detail how the physical and digital evidence disproves the alibi..."
                        value={accusedReasoning}
                        onChange={(e) => setAccusedReasoning(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', background: '#050d14', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="product-btn product-btn--primary"
                      style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 800, alignSelf: 'flex-start' }}
                    >
                      File Formal Accusation ↗
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Toast Notice */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toastMessage.type === 'error' ? '#ff4d5e' : toastMessage.type === 'success' ? '#00c8e9' : '#d4f04a',
          color: '#000',
          padding: '12px 20px',
          borderRadius: '6px',
          fontWeight: 800,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          zIndex: 100,
        }}>
          {toastMessage.msg}
        </div>
      )}

      {/* Guidelines Modal */}
      <InvestigationGuidelinesModal
        isOpen={showGuidelines}
        onClose={() => setShowGuidelines(false)}
      />

      {/* Results Modal */}
      {showResultsModal && (
        <ResultsModal
          result={{
            completed: isAgreed,
            score: caseState?.score || Math.max(150, 500 - (caseState?.wrongAttempts || 0) * 15),
            durationMs: deadline ? Math.max(0, 2700000 - Math.max(0, deadline - Date.now())) : 0,
            wrongAttempts: caseState?.wrongAttempts || 0,
            cluesCount: clues.length,
            suspect: caseState?.accusation?.suspect,
            teamId,
          }}
          onClose={() => setShowResultsModal(false)}
          onBack={onBack}
        />
      )}
    </div>
  );
}
