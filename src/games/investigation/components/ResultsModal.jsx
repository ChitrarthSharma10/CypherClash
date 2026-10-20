import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function ResultsModal({ result, onRestart }) {
  if (!result) return null;

  const {
    completed = false,
    score = 0,
    durationMs = 0,
    rawStats = {},
    breakdown = {},
    teamId = 'Team',
  } = result;

  useEffect(() => {
    if (completed) {
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }
    }
  }, [completed]);

  const durationSec = Math.round(durationMs / 1000);
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const timeFormatted = `${mins}m ${secs}s`;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '640px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span className="badge" style={{
            background: completed ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255, 77, 94, 0.2)',
            color: completed ? '#2ecc71' : '#ff4d5e',
            borderColor: completed ? 'rgba(46, 204, 113, 0.5)' : 'rgba(255, 77, 94, 0.5)',
            fontSize: '12px',
            fontWeight: 800,
          }}>
            {completed ? 'INVESTIGATION RESOLVED' : 'TIME EXPIRED / INCOMPLETE'}
          </span>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '12px 0 4px', color: '#ffffff' }}>
            {completed ? 'Incident Case Solved!' : 'Investigation Concluded'}
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Official Round 3 Result for <strong>{teamId}</strong>
          </p>
        </div>

        {/* Big Score Card */}
        <div style={{
          background: 'rgba(0, 200, 233, 0.1)',
          border: '1px solid rgba(0, 200, 233, 0.3)',
          borderRadius: '10px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#00c8e9', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Final Team Score
          </div>
          <div style={{ fontSize: '48px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
            {score} <span style={{ fontSize: '20px', color: '#00c8e9' }}>PTS</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
            Time Elapsed: {timeFormatted}
          </div>
        </div>

        {/* Score Breakdown Table */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '14px',
          fontSize: '13px',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '8px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontSize: '11px' }}>
            Scoring & Penalty Breakdown
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Stages Cleared ({rawStats.stagesCleared || 0}/4):</span>
            <strong>+{breakdown.stagesPoints || 0} pts</strong>

            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Verified Evidence Links ({rawStats.correctConnections || 0}):</span>
            <strong>+{breakdown.evidencePoints || 0} pts</strong>

            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Final Case Verdict:</span>
            <strong style={{ color: rawStats.finalCorrect ? '#2ecc71' : '#ff4d5e' }}>
              {rawStats.finalCorrect ? `+${breakdown.finalVerdictPoints || 500} pts` : '+0 pts'}
            </strong>

            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Time Bonus:</span>
            <strong>+{breakdown.timeBonus || 0} pts</strong>

            <span style={{ color: '#ff4d5e' }}>Penalties (Hints + Bad Guesses):</span>
            <strong style={{ color: '#ff4d5e' }}>-{breakdown.penalties || 0} pts</strong>
          </div>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '12px' }}>
          <button
            type="button"
            className="submit-btn"
            onClick={() => window.location.href = 'http://localhost:5173'}
            style={{ background: '#ffffff', color: '#000000', padding: '12px 28px', fontWeight: 800 }}
          >
            Return to Tournament Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
