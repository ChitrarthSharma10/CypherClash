import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function ResultsModal({ result, onClose, onBack }) {
  if (!result) return null;

  const {
    completed = false,
    score = 0,
    durationMs = 0,
    wrongAttempts = 0,
    cluesCount = 4,
    suspect = 'Mara Chen',
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
  const timeFormatted = durationMs > 0 ? `${mins}m ${secs}s` : '—';

  const penalty = wrongAttempts * 15;
  const rawCalculated = 500 - penalty;
  const floorApplied = completed && rawCalculated < 150;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '640px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span
            className="badge"
            style={{
              background: completed ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255, 77, 94, 0.2)',
              color: completed ? '#2ecc71' : '#ff4d5e',
              borderColor: completed ? 'rgba(46, 204, 113, 0.5)' : 'rgba(255, 77, 94, 0.5)',
              fontSize: '12px',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '20px',
              display: 'inline-block',
            }}
          >
            {completed ? 'INVESTIGATION RESOLVED & SCORED ✓' : 'TIME EXPIRED / INCOMPLETE'}
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '12px 0 4px', color: '#ffffff' }}>
            {completed ? 'Incident Case Solved!' : 'Investigation Concluded'}
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Official Round 3 Result for Team <strong>{teamId}</strong>
          </p>
        </div>

        {/* Big Score Card */}
        <div
          style={{
            background: 'rgba(0, 200, 233, 0.08)',
            border: '1px solid rgba(0, 200, 233, 0.3)',
            borderRadius: '10px',
            padding: '18px',
            textAlign: 'center',
            margin: '16px 0',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#00c8e9', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Final Team Score
          </div>
          <div style={{ fontSize: '52px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
            {score} <span style={{ fontSize: '22px', color: '#00c8e9' }}>PTS</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
            Formula: <code>max(150, 500 - 15W)</code> {timeFormatted !== '—' && `• Time: ${timeFormatted}`}
          </div>
        </div>

        {/* Score Breakdown Table */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '10px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
            Scoring & Penalty Breakdown
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>Base Completion Score (All 4 Clues Logged):</span>
            <strong style={{ color: '#2ecc71' }}>+500 pts</strong>

            <span style={{ color: 'rgba(255,255,255,0.8)' }}>
              Incorrect Submissions ({wrongAttempts} attempt{wrongAttempts === 1 ? '' : 's'} × -15 pts):
            </span>
            <strong style={{ color: wrongAttempts > 0 ? '#ff4d5e' : 'rgba(255,255,255,0.6)' }}>
              {wrongAttempts > 0 ? `-${penalty} pts` : '0 pts'}
            </strong>

            {floorApplied && (
              <>
                <span style={{ color: '#00c8e9' }}>Floor Guarantee Adjustment (Min. 150 pts):</span>
                <strong style={{ color: '#00c8e9' }}>+{150 - rawCalculated} pts</strong>
              </>
            )}

            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />

            <span style={{ color: '#ffffff', fontWeight: 700 }}>Final Official Score:</span>
            <strong style={{ color: '#00c8e9', fontSize: '15px' }}>{score} pts</strong>
          </div>

          {suspect && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              Accused & Verified Suspect: <strong style={{ color: '#e6f4f8' }}>{suspect}</strong> (Mutual Detective & Analyst Agreement)
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '18px', display: 'flex', gap: '12px' }}>
          {onClose && (
            <button
              type="button"
              className="product-btn"
              onClick={onClose}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#ffffff', padding: '10px 20px', fontWeight: 700 }}
            >
              Review Case Board
            </button>
          )}
          <button
            type="button"
            className="submit-btn"
            onClick={() => {
              if (onBack) onBack();
              else window.location.href = '/';
            }}
            style={{ background: '#00c8e9', color: '#050d14', border: 0, padding: '10px 24px', fontWeight: 800, borderRadius: '4px', cursor: 'pointer' }}
          >
            Return to Tournament Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
