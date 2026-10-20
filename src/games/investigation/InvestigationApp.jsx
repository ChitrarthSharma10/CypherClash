import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import ConstellationCanvas from './components/ConstellationCanvas.jsx';
import InvestigationGuidelinesModal from './components/InvestigationGuidelinesModal.jsx';
import ResultsModal from './components/ResultsModal.jsx';
import TimeLeftBanner from '../../components/TimeLeftBanner.jsx';

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
    detail: 'Witness heard the electronic latch release on the archive door near 02:20.',
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

async function parseJsonResponse(res) {
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
}

/**
 * Individual station panel for Lead Detective or Forensic Analyst
 */
function InvestigationStationPanel({
  actingRole,
  teamId,
  apiBase,
  isSplit = false,
  onShowResults,
  analystInviteCode,
  isRoundEnded = false,
}) {
  const [caseState, setCaseState] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [decryptToken, setDecryptToken] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState(null);

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

  const getHeaders = useCallback(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (actingRole) {
      headers['x-acting-role'] = actingRole;
    }
    return headers;
  }, [actingRole]);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/investigation/state`, {
        credentials: 'include',
        headers: getHeaders(),
      });
      if (res.status === 401 || res.status === 403) {
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
      setLoading(false);
      return data;
    } catch {
      setLoading(false);
      return null;
    }
  }, [apiBase, getHeaders]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1800);
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleAddEvidence = async (key) => {
    if (isRoundEnded) return;
    try {
      const res = await fetch(`${apiBase}/api/investigation/evidence`, {
        method: 'POST',
        headers: getHeaders(),
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

  const handleDecrypt = async (e) => {
    e.preventDefault();
    if (isRoundEnded) return;
    const token = decryptToken.trim();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/investigation/decrypt`, {
        method: 'POST',
        headers: getHeaders(),
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

  const handleSubmitAccusation = async (e) => {
    e.preventDefault();
    if (isRoundEnded) return;
    if (accusedReasoning.trim().length < 20) {
      showToast('Reasoning must be at least 20 characters', 'error');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/investigation/accusation`, {
        method: 'POST',
        headers: getHeaders(),
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

  const handleApproveAccusation = async () => {
    if (isRoundEnded) return;
    try {
      const res = await fetch(`${apiBase}/api/investigation/accusation/approve`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      setCaseState(data.state);
      if (onShowResults) onShowResults(data.state);
      showToast('Accusation approved by both specialists! Case resolved and scored.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const roleTitle = actingRole === 'detective' ? 'Lead Detective' : 'Forensic Analyst';
  const clues = caseState?.clues || [];
  const cluesMap = new Map(clues.map((c) => [c.key, c]));
  const isAgreed = caseState?.accusation?.agreed;
  const isPendingApproval = caseState?.accusation && !isAgreed;
  const canApprove = isPendingApproval && caseState?.accusation?.submittedBy !== actingRole;

  return (
    <div className={isSplit ? 'investigation-split-panel' : 'investigation-panel-single'}>
      {/* Panel Role Header */}
      <div className="investigation-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '4px',
            fontWeight: 800,
            background: actingRole === 'detective' ? 'rgba(0, 200, 233, 0.2)' : 'rgba(212, 240, 74, 0.2)',
            border: `1px solid ${actingRole === 'detective' ? '#00c8e9' : '#d4f04a'}`,
            color: actingRole === 'detective' ? '#00c8e9' : '#d4f04a',
          }}>
            {actingRole === 'detective' ? '⌕ STATION 01' : '⌘ STATION 02'}
          </span>
          <h2 className="investigation-panel-role-title" style={{ color: actingRole === 'detective' ? '#00c8e9' : '#d4f04a' }}>
            {roleTitle}
          </h2>
        </div>
        <span style={{ fontSize: '11px', color: '#9fb8c2' }}>
          {isAgreed ? 'CASE CLOSED ✓' : isPendingApproval ? 'PENDING APPROVAL ⏳' : 'ACTIVE'}
        </span>
      </div>

      {/* Panel Scrollable Content */}
      <div className="investigation-panel-content">
        {errorNotice && (
          <div style={{ background: 'rgba(255, 77, 94, 0.15)', border: '1px solid #ff4d5e', padding: '12px', borderRadius: '6px', color: '#ffb3b8', fontSize: '12px' }}>
            <strong>Notice:</strong> {errorNotice}
          </div>
        )}

        {isRoundEnded && (
          <div style={{ background: 'rgba(255, 77, 94, 0.2)', border: '1px solid #ff4d5e', padding: '12px', borderRadius: '6px', color: '#ffb3b8', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
            The round has ended. Inputs are locked and submissions can no longer be accepted.
          </div>
        )}

        {loading && !caseState && (
          <div style={{ padding: '30px', textAlign: 'center', color: '#9fb8c2', fontSize: '13px' }}>
            Connecting to {roleTitle} station…
          </div>
        )}

        {caseState && (
          <>
            {/* Stat Ribbon */}
            <div style={{ display: 'grid', gridTemplateColumns: isSplit ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)', gap: '10px' }}>
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '10px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '9px', color: '#9fb8c2', fontWeight: 700 }}>EVIDENCE</span>
                <strong style={{ fontSize: '16px', display: 'block', color: '#00c8e9', marginTop: '2px' }}>
                  {clues.length} / 4
                </strong>
              </div>
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '10px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '9px', color: '#9fb8c2', fontWeight: 700 }}>DECRYPTION</span>
                <strong style={{ fontSize: '16px', display: 'block', color: caseState.decrypted ? '#d4f04a' : '#ff4d5e', marginTop: '2px' }}>
                  {caseState.decrypted ? 'DECRYPTED ✓' : 'LOCKED ✗'}
                </strong>
              </div>
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '10px 12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '9px', color: '#9fb8c2', fontWeight: 700 }}>SCORE</span>
                <strong style={{ fontSize: '16px', display: 'block', color: isAgreed ? '#2ecc71' : '#00c8e9', marginTop: '2px' }}>
                  {caseState.score || Math.max(150, 500 - (caseState.wrongAttempts || 0) * 15)} PTS
                </strong>
              </div>
              {!isSplit && (
                <>
                  <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '10px 12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '9px', color: '#9fb8c2', fontWeight: 700 }}>WRONG ATTEMPTS</span>
                    <strong style={{ fontSize: '16px', display: 'block', color: (caseState.wrongAttempts || 0) > 0 ? '#ff4d5e' : '#2ecc71', marginTop: '2px' }}>
                      {caseState.wrongAttempts || 0}
                    </strong>
                  </div>
                  <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', padding: '10px 12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '9px', color: '#9fb8c2', fontWeight: 700 }}>STATUS</span>
                    <strong style={{ fontSize: '13px', display: 'block', color: isAgreed ? '#d4f04a' : isPendingApproval ? '#00c8e9' : '#9fb8c2', marginTop: '4px' }}>
                      {isAgreed ? 'CLOSED ✓' : isPendingApproval ? 'PENDING ⏳' : 'OPEN'}
                    </strong>
                  </div>
                </>
              )}
            </div>

            {/* Detective Analyst Share Bar */}
            {analystInviteCode && actingRole === 'detective' && !isSplit && (
              <div style={{ background: 'rgba(0, 200, 233, 0.08)', border: '1px solid #00c8e9', padding: '10px 14px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#00c8e9', fontSize: '12px' }}>Analyst Invite:</strong>
                  <span style={{ marginLeft: '8px', fontFamily: 'monospace', fontSize: '12px', background: '#050d14', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,200,233,0.3)', color: '#fff' }}>
                    {analystInviteCode}
                  </span>
                </div>
                <button
                  className="product-btn product-btn--small"
                  onClick={() => {
                    navigator.clipboard.writeText(analystInviteCode);
                    showToast('Invite code copied to clipboard!', 'success');
                  }}
                  style={{ background: '#00c8e9', color: '#000', border: 0, fontWeight: 700, fontSize: '11px', padding: '4px 10px' }}
                >
                  Copy
                </button>
              </div>
            )}

            {/* Navigation Tabs */}
            <nav style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(0,200,233,0.2)', paddingBottom: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'evidence', label: `Evidence (${clues.length}/4)` },
                { id: 'forensics', label: 'Forensics' },
                { id: 'suspects', label: 'Suspects' },
                { id: 'accusation', label: isAgreed ? 'Resolution ✓' : 'Accusation' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: activeTab === tab.id ? 'rgba(0, 200, 233, 0.15)' : 'transparent',
                    border: `1px solid ${activeTab === tab.id ? '#00c8e9' : 'rgba(255,255,255,0.1)'}`,
                    color: activeTab === tab.id ? '#00c8e9' : '#9fb8c2',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '10px', color: '#00c8e9', fontWeight: 800 }}>MISSION BRIEF // INCIDENT CC-03-017</span>
                  <h3 style={{ fontSize: '16px', margin: '6px 0 10px', fontWeight: 800 }}>The Helix Archive Breach</h3>
                  <p style={{ color: '#9fb8c2', lineHeight: 1.5, fontSize: '12px', margin: 0 }}>
                    At 02:13 UTC, unauthorized telemetry was detected within the bio-research archive. The perpetrator used an internal access badge and encrypted token (HELIX) to gain root privileges.
                  </p>
                  <p style={{ color: '#9fb8c2', lineHeight: 1.5, fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
                    <strong>Objective:</strong> Gather verified evidence, decrypt the token in the Forensic Terminal, cross-reference suspect alibis, and submit a joint accusation with partner approval.
                  </p>
                </div>

                {/* Activity Feed */}
                <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.2)', borderRadius: '6px', padding: '14px' }}>
                  <span style={{ fontSize: '10px', color: '#00c8e9', fontWeight: 800 }}>INCIDENT ACTIVITY TELEMETRY</span>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {(caseState.activity || []).slice().reverse().map((act, idx) => (
                      <div key={idx} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${act.role === 'detective' ? '#00c8e9' : act.role === 'analyst' ? '#d4f04a' : '#9fb8c2'}`, borderRadius: '3px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <strong style={{ color: act.role === 'detective' ? '#00c8e9' : '#d4f04a' }}>
                            {act.role === 'detective' ? 'Lead Detective' : act.role === 'analyst' ? 'Forensic Analyst' : 'System'}
                          </strong>
                          <span style={{ color: '#9fb8c2', fontSize: '9px' }}>
                            {new Date(act.at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#e6f4f8' }}>{act.message}</p>
                      </div>
                    ))}
                    {(!caseState.activity || caseState.activity.length === 0) && (
                      <span style={{ color: '#9fb8c2', fontSize: '11px' }}>No actions logged yet.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: EVIDENCE */}
            {activeTab === 'evidence' && (
              <div style={{ display: 'grid', gridTemplateColumns: isSplit ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
                {['ev1', 'ev2', 'ev3', 'ev4'].map((key) => {
                  const item = EVIDENCE_ITEMS[key];
                  const inLedger = cluesMap.has(key);
                  const isDecryptable = key === 'ev4';
                  const isEv1 = key === 'ev1';
                  const isDetectiveOnly = isEv1 && actingRole !== 'detective';

                  return (
                    <div
                      key={key}
                      style={{
                        background: inLedger ? 'rgba(0, 200, 233, 0.06)' : '#0a1620',
                        border: `1px solid ${inLedger ? '#00c8e9' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '6px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', color: '#00c8e9', fontWeight: 800 }}>{item.id} // {item.source}</span>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: inLedger ? '#00c8e9' : 'rgba(255,255,255,0.1)',
                            color: inLedger ? '#000' : '#9fb8c2',
                          }}>
                            {inLedger ? 'IN LEDGER ✓' : 'UNCOMMITTED'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '14px', margin: '2px 0 6px', color: '#fff' }}>{item.title}</h4>
                        <p style={{ fontSize: '12px', color: inLedger ? '#e6f4f8' : '#9fb8c2', lineHeight: 1.4, margin: 0 }}>
                          {item.detail}
                        </p>
                      </div>

                      <div style={{ marginTop: '12px' }}>
                        {inLedger ? (
                          <span style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 700 }}>
                            ✓ Added by {cluesMap.get(key)?.addedBy === 'detective' ? 'Lead Detective' : 'Forensic Analyst'}
                          </span>
                        ) : isDecryptable ? (
                          <button
                            onClick={() => setActiveTab('forensics')}
                            className="product-btn product-btn--light"
                            style={{ fontSize: '11px', padding: '5px 12px' }}
                          >
                            Go to Terminal to Decrypt →
                          </button>
                        ) : isDetectiveOnly ? (
                          <span style={{ fontSize: '11px', color: '#ffb3b8', fontStyle: 'italic' }}>
                            (Lead Detective authorization required for EV-001)
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddEvidence(key)}
                            disabled={isRoundEnded}
                            className="product-btn product-btn--primary"
                            style={{ fontSize: '11px', padding: '5px 12px' }}
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

            {/* TAB: FORENSIC TERMINAL */}
            {activeTab === 'forensics' && (
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.3)', borderRadius: '6px', padding: '16px' }}>
                <span style={{ fontSize: '10px', color: '#d4f04a', fontWeight: 800 }}>NETWORK INTERCEPTION TERMINAL</span>
                <h3 style={{ fontSize: '16px', margin: '6px 0 10px', fontWeight: 800 }}>Packet #884 Cryptographic Analysis</h3>
                <p style={{ color: '#9fb8c2', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                  Border sniffers captured an encrypted handshake between the rogue terminal and the internal archive. Research project codename: <strong>HELIX</strong>.
                </p>

                <div style={{ marginTop: '12px', background: '#050d14', border: '1px solid rgba(0,200,233,0.2)', borderRadius: '4px', padding: '10px', fontFamily: 'monospace', fontSize: '11px', color: '#00c8e9' }}>
                  <div>FRAME: 0x2A14 // PROTOCOL: TLSv1.3 // CIPHER: CHACHA20-POLY1305</div>
                  <div>STATUS: {caseState.decrypted ? 'DECRYPTED — EV-004 COMMITTED' : 'AWAITING KEY DECRYPTION'}</div>
                </div>

                {actingRole !== 'analyst' && !caseState.decrypted && (
                  <div style={{ marginTop: '14px', padding: '10px', background: 'rgba(212, 240, 74, 0.08)', border: '1px solid #d4f04a', borderRadius: '4px', color: '#d4f04a', fontSize: '12px' }}>
                    Note: Only the Forensic Analyst can execute network payload decryption.
                  </div>
                )}

                {actingRole === 'analyst' && !caseState.decrypted && (
                  <form onSubmit={handleDecrypt} style={{ marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Enter token (e.g. HELIX)..."
                      value={decryptToken}
                      onChange={(e) => setDecryptToken(e.target.value)}
                      disabled={isRoundEnded}
                      style={{ padding: '8px 12px', background: '#050d14', border: '1px solid rgba(0,200,233,0.4)', borderRadius: '4px', color: '#fff', fontSize: '12px', flex: 1, minWidth: '180px' }}
                    />
                    <button type="submit" disabled={isRoundEnded} className="product-btn" style={{ padding: '8px 16px', background: '#d4f04a', color: '#000', border: 0, fontWeight: 800, fontSize: '12px' }}>
                      Execute Decryption ⚡
                    </button>
                  </form>
                )}

                {caseState.decrypted && (
                  <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(212, 240, 74, 0.1)', border: '1px solid #d4f04a', borderRadius: '4px', color: '#d4f04a', fontSize: '12px', fontWeight: 700 }}>
                    ✓ Decryption Succeeded. Recovered Token: HELIX. Evidence EV-004 is active in ledger.
                  </div>
                )}
              </div>
            )}

            {/* TAB: SUSPECTS */}
            {activeTab === 'suspects' && (
              <div style={{ display: 'grid', gridTemplateColumns: isSplit ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
                {SUSPECTS.map((suspect) => (
                  <div key={suspect.name} style={{ background: '#0a1620', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '15px', margin: 0, color: '#fff' }}>{suspect.name}</h4>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '3px',
                        background: suspect.risk === 'HIGH' ? '#ff4d5e' : suspect.risk === 'MEDIUM' ? '#d4f04a' : 'rgba(255,255,255,0.1)',
                        color: suspect.risk === 'HIGH' ? '#fff' : suspect.risk === 'MEDIUM' ? '#000' : '#9fb8c2',
                      }}>
                        {suspect.risk} RISK
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#00c8e9', marginTop: '2px', fontWeight: 700 }}>
                      {suspect.role} · BADGE {suspect.badge}
                    </div>
                    <p style={{ fontSize: '11px', color: '#9fb8c2', marginTop: '8px', lineHeight: 1.4, margin: 0 }}>
                      <strong>Access:</strong> {suspect.access}
                    </p>
                    <p style={{ fontSize: '11px', color: '#e6f4f8', marginTop: '4px', lineHeight: 1.4, margin: 0 }}>
                      <strong>Alibi:</strong> {suspect.alibi}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: ACCUSATION */}
            {activeTab === 'accusation' && (
              <div style={{ background: '#0a1620', border: '1px solid rgba(0,200,233,0.3)', borderRadius: '6px', padding: '18px' }}>
                <span style={{ fontSize: '10px', color: '#00c8e9', fontWeight: 800 }}>CASE RESOLUTION // FORMAL ACCUSATION</span>
                <h3 style={{ fontSize: '16px', margin: '6px 0 12px', fontWeight: 800 }}>Synthesize Evidence & Name the Culprit</h3>

                {isAgreed ? (
                  <div style={{ background: 'rgba(212, 240, 74, 0.08)', border: '1px solid #d4f04a', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                    <span style={{ fontSize: '32px' }}>🏆</span>
                    <h4 style={{ fontSize: '20px', margin: '8px 0 4px', color: '#d4f04a', fontWeight: 800 }}>Case Solved & Verified</h4>
                    <p style={{ color: '#e6f4f8', fontSize: '13px', margin: '0 auto 14px', lineHeight: 1.5 }}>
                      Mutual agreement reached on the indictment against <strong>{caseState.accusation.suspect}</strong> supported by <strong>{EVIDENCE_ITEMS[caseState.accusation.evidenceKey]?.id}</strong>.
                    </p>
                    <div style={{
                      background: 'rgba(5, 13, 20, 0.95)',
                      border: '1px solid rgba(0, 200, 233, 0.4)',
                      borderRadius: '8px',
                      padding: '14px 18px',
                      margin: '0 auto 14px',
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#00c8e9', textTransform: 'uppercase' }}>
                        Round 3 Official Score
                      </div>
                      <div style={{ fontSize: '36px', fontWeight: 900, color: '#ffffff', margin: '2px 0' }}>
                        {caseState.score || Math.max(150, 500 - (caseState.wrongAttempts || 0) * 15)} <span style={{ fontSize: '16px', color: '#00c8e9' }}>PTS</span>
                      </div>
                    </div>
                  </div>
                ) : isPendingApproval ? (
                  <div style={{ background: 'rgba(0, 200, 233, 0.08)', border: '1px solid #00c8e9', borderRadius: '6px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ fontSize: '15px', margin: 0, color: '#fff' }}>Accusation Pending Partner Review</h4>
                      <span style={{ fontSize: '10px', background: '#00c8e9', color: '#000', padding: '2px 6px', borderRadius: '3px', fontWeight: 800 }}>
                        FROM {caseState.accusation.submittedBy.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#e6f4f8' }}>
                      <p style={{ margin: '2px 0' }}><strong>Suspect:</strong> {caseState.accusation.suspect}</p>
                      <p style={{ margin: '2px 0' }}><strong>Evidence:</strong> {EVIDENCE_ITEMS[caseState.accusation.evidenceKey]?.id} — {EVIDENCE_ITEMS[caseState.accusation.evidenceKey]?.title}</p>
                      <p style={{ margin: '2px 0' }}><strong>Reasoning:</strong> {caseState.accusation.reasoning}</p>
                    </div>

                    {canApprove ? (
                      <div style={{ marginTop: '14px' }}>
                        <button
                          onClick={handleApproveAccusation}
                          disabled={isRoundEnded}
                          className="product-btn"
                          style={{ background: '#d4f04a', color: '#000', border: 0, fontWeight: 800, padding: '8px 18px', fontSize: '13px', cursor: 'pointer' }}
                        >
                          Approve Accusation & Close Case ✓
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: '12px', color: '#9fb8c2', fontSize: '12px', fontStyle: 'italic' }}>
                        Waiting for your partner ({caseState.accusation.submittedBy === 'detective' ? 'Forensic Analyst' : 'Lead Detective'}) to approve this accusation.
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSubmitAccusation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: '#00c8e9', fontWeight: 700, display: 'block', marginBottom: '4px' }}>NAME SUSPECT</label>
                      <select
                        value={accusedSuspect}
                        onChange={(e) => setAccusedSuspect(e.target.value)}
                        disabled={isRoundEnded}
                        style={{ width: '100%', padding: '8px 10px', background: '#050d14', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                      >
                        {SUSPECTS.map((s) => (
                          <option key={s.name} value={s.name}>{s.name} ({s.role})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', color: '#00c8e9', fontWeight: 700, display: 'block', marginBottom: '4px' }}>SUPPORTING EVIDENCE</label>
                      <select
                        value={accusedEvidence}
                        onChange={(e) => setAccusedEvidence(e.target.value)}
                        disabled={isRoundEnded}
                        style={{ width: '100%', padding: '8px 10px', background: '#050d14', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                      >
                        {['ev1', 'ev2', 'ev3', 'ev4'].map((k) => (
                          <option key={k} value={k} disabled={!cluesMap.has(k)}>
                            {EVIDENCE_ITEMS[k]?.id} — {EVIDENCE_ITEMS[k]?.title} {!cluesMap.has(k) ? '(Not in ledger)' : '✓'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', color: '#00c8e9', fontWeight: 700, display: 'block', marginBottom: '4px' }}>CASE REASONING (Min 20 chars)</label>
                      <textarea
                        rows={3}
                        placeholder="Detail how evidence disproves the alibi..."
                        value={accusedReasoning}
                        onChange={(e) => setAccusedReasoning(e.target.value)}
                        disabled={isRoundEnded}
                        style={{ width: '100%', padding: '8px 10px', background: '#050d14', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isRoundEnded}
                      className="product-btn product-btn--primary"
                      style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 800, alignSelf: 'flex-start' }}
                    >
                      File Formal Accusation ↗
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast Notice */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toastMessage.type === 'error' ? '#ff4d5e' : toastMessage.type === 'success' ? '#00c8e9' : '#d4f04a',
          color: '#000',
          padding: '10px 18px',
          borderRadius: '4px',
          fontWeight: 800,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          zIndex: 100,
          fontSize: '12px',
        }}>
          {toastMessage.msg}
        </div>
      )}
    </div>
  );
}

export default function InvestigationApp({
  teamId = 'CC-001',
  apiUrl,
  round,
  serverNow,
  onBack,
  onLogout,
}) {
  const apiBase = apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const [role, setRole] = useState(null);
  const [isSplitMode, setIsSplitMode] = useState(() => {
    try {
      return sessionStorage.getItem(`investigation_split_${teamId}`) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileTab, setMobileTab] = useState('detective'); // 'detective' | 'analyst'
  const [analystInviteCode, setAnalystInviteCode] = useState(() => {
    try {
      return sessionStorage.getItem(`analyst_invite_${teamId}`) || '';
    } catch {
      return '';
    }
  });
  const [inviteInput, setInviteInput] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [latestState, setLatestState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState(null);
  const [serverRound, setServerRound] = useState(null);
  const [caseServerNow, setCaseServerNow] = useState(null);

  // Poll state to check existing session
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/investigation/state`, { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        setLoading(false);
        return null;
      }
      const data = await parseJsonResponse(res);
      if (res.ok) {
        if (data.hasBothSeats) {
          setIsSplitMode(true);
          try {
            sessionStorage.setItem(`investigation_split_${teamId}`, 'true');
          } catch {}
        } else if (data.state?.role) {
          setRole(data.state.role);
        }
        if (data.deadline || data.roundStatus) {
          setServerRound({ status: data.roundStatus, deadline: data.deadline });
        }
        if (data.serverNow) {
          setCaseServerNow(data.serverNow);
        }
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [apiBase, teamId]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

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
      setRole('detective');
      setIsSplitMode(false);
      try {
        sessionStorage.removeItem(`investigation_split_${teamId}`);
      } catch {}
      if (data.analystInvite) {
        setAnalystInviteCode(data.analystInvite);
        try {
          sessionStorage.setItem(`analyst_invite_${teamId}`, data.analystInvite);
        } catch {}
      }
      await checkSession();
    } catch (err) {
      setErrorNotice(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAnalyst = async () => {
    const code = inviteInput.trim();
    if (!code) {
      setErrorNotice('Please enter an analyst invite code');
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
      setRole('analyst');
      setIsSplitMode(false);
      try {
        sessionStorage.removeItem(`investigation_split_${teamId}`);
      } catch {}
      await checkSession();
    } catch (err) {
      setErrorNotice(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSameScreen = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/api/investigation/join/same-screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Failed to initialize split-screen mode');
      setIsSplitMode(true);
      try {
        sessionStorage.setItem(`investigation_split_${teamId}`, 'true');
      } catch {}
      await checkSession();
    } catch (err) {
      setErrorNotice(err.message);
    } finally {
      setLoading(false);
    }
  };

  const effectiveRound = round || serverRound;
  const effectiveServerNow = serverNow || caseServerNow;
  const isRoundEnded = effectiveRound?.status === 'ended';

  return (
    <div className="investigation-shell" style={{ background: '#050d14', color: '#e6f4f8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ConstellationCanvas />

      {/* Item 3 Time-Left Banner across entire investigation */}
      <TimeLeftBanner round={effectiveRound} serverNow={effectiveServerNow} />

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
            {isSplitMode ? (
              <span style={{
                background: 'rgba(212, 240, 74, 0.2)',
                border: '1px solid #d4f04a',
                color: '#d4f04a',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
              }}>
                SPLIT-SCREEN ACTIVE (DUAL ROLES)
              </span>
            ) : role ? (
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
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
            Guidelines 📋
          </button>
          {onLogout && (
            <button
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

      {/* Main Investigation Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 2, width: '100%', boxSizing: 'border-box' }}>
        {errorNotice && (
          <div style={{ margin: '16px 24px 0', background: 'rgba(255, 77, 94, 0.15)', border: '1px solid #ff4d5e', padding: '12px 16px', borderRadius: '6px', color: '#ffb3b8', fontSize: '13px' }}>
            <strong>Notice:</strong> {errorNotice}
          </div>
        )}

        {/* NOT JOINED SCREEN: Station Selection */}
        {!role && !isSplitMode && !loading && (
          <section style={{ background: '#0a1620', border: '1px solid rgba(0, 200, 233, 0.3)', borderRadius: '12px', padding: '32px', textAlign: 'center', maxWidth: '840px', margin: '40px auto' }}>
            <span style={{ color: '#00c8e9', fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' }}>IDENTITY CHECK & STATION CLAIM</span>
            <h2 style={{ fontSize: '26px', margin: '10px 0 16px', fontWeight: 800 }}>Choose Your Investigation Station</h2>
            <p style={{ color: '#9fb8c2', fontSize: '14px', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 28px' }}>
              Round 3 operates on an authoritative cooperative case structure. Join individually on separate devices or launch split-screen mode to control both stations simultaneously on this device.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', textAlign: 'left' }}>
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

            {/* Split Screen Launch Option */}
            <div style={{
              marginTop: '20px',
              background: 'rgba(0, 200, 233, 0.08)',
              border: '1px solid #00c8e9',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'left',
              flexWrap: 'wrap',
              gap: '16px',
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 800 }}>STATIONS 01 & 02 // SAME SCREEN</span>
                <h3 style={{ fontSize: '18px', margin: '4px 0', color: '#fff' }}>Launch Split-Screen Mode</h3>
                <p style={{ fontSize: '13px', color: '#9fb8c2', margin: 0, lineHeight: 1.5 }}>
                  Play both Lead Detective and Forensic Analyst on this single screen side by side.
                </p>
              </div>
              <button
                onClick={handleJoinSameScreen}
                className="product-btn product-btn--primary"
                style={{ padding: '12px 24px', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap' }}
              >
                Launch Split-Screen Mode ↗
              </button>
            </div>
          </section>
        )}

        {/* SPLIT SCREEN MODE */}
        {isSplitMode && (
          <div className="investigation-split-wrapper">
            {/* Narrow Screen Switch Tabs */}
            <div className="investigation-split-controls">
              <button
                className={`investigation-split-tab-btn ${mobileTab === 'detective' ? 'is-active' : ''}`}
                onClick={() => setMobileTab('detective')}
              >
                Lead Detective
              </button>
              <button
                className={`investigation-split-tab-btn ${mobileTab === 'analyst' ? 'is-active' : ''}`}
                onClick={() => setMobileTab('analyst')}
              >
                Forensic Analyst
              </button>
            </div>

            <div className="investigation-split-container">
              {/* Left Column: Lead Detective */}
              <div className={mobileTab === 'detective' ? '' : 'is-hidden-mobile'}>
                <InvestigationStationPanel
                  actingRole="detective"
                  teamId={teamId}
                  apiBase={apiBase}
                  isSplit={true}
                  onShowResults={(res) => {
                    setLatestState(res);
                    setShowResultsModal(true);
                  }}
                  analystInviteCode={analystInviteCode}
                  isRoundEnded={isRoundEnded}
                />
              </div>

              {/* Right Column: Forensic Analyst */}
              <div className={mobileTab === 'analyst' ? '' : 'is-hidden-mobile'}>
                <InvestigationStationPanel
                  actingRole="analyst"
                  teamId={teamId}
                  apiBase={apiBase}
                  isSplit={true}
                  onShowResults={(res) => {
                    setLatestState(res);
                    setShowResultsModal(true);
                  }}
                  analystInviteCode={analystInviteCode}
                  isRoundEnded={isRoundEnded}
                />
              </div>
            </div>
          </div>
        )}

        {/* SINGLE STATION WORKSPACE */}
        {!isSplitMode && role && (
          <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', padding: '20px 24px', boxSizing: 'border-box' }}>
            <InvestigationStationPanel
              actingRole={role}
              teamId={teamId}
              apiBase={apiBase}
              isSplit={false}
              onShowResults={(res) => {
                setLatestState(res);
                setShowResultsModal(true);
              }}
              analystInviteCode={analystInviteCode}
              isRoundEnded={isRoundEnded}
            />
          </div>
        )}
      </main>

      {/* Guidelines Modal */}
      <InvestigationGuidelinesModal
        isOpen={showGuidelines}
        onClose={() => setShowGuidelines(false)}
      />

      {/* Results Modal */}
      {showResultsModal && (
        <ResultsModal
          result={{
            completed: latestState?.accusation?.agreed || false,
            score: latestState?.score || Math.max(150, 500 - (latestState?.wrongAttempts || 0) * 15),
            durationMs: 0,
            wrongAttempts: latestState?.wrongAttempts || 0,
            cluesCount: latestState?.clues?.length || 4,
            suspect: latestState?.accusation?.suspect,
            teamId,
          }}
          onClose={() => setShowResultsModal(false)}
          onBack={onBack}
        />
      )}
    </div>
  );
}
