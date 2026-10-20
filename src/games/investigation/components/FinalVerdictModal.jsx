import React, { useState } from 'react';

export default function FinalVerdictModal({ onSubmitVerdict, isOpen, onClose }) {
  const [verdict, setVerdict] = useState('MALICIOUS');
  const [tokenInput, setTokenInput] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (!isOpen) return null;

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setShowConfirmDialog(true);
  };

  const handleFinalConfirm = () => {
    if (onSubmitVerdict) {
      onSubmitVerdict(verdict, tokenInput.trim());
    }
    setShowConfirmDialog(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Final Investigation Resolution & Verdict
          </h2>
          <span className="badge" style={{ background: '#ff4d5e', color: '#ffffff', fontWeight: 700 }}>
            FINAL STAGE
          </span>
        </div>

        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5, margin: 0 }}>
          Both players must collaborate to deliver the final verdict on the emergency key export request. Assemble the composite Incident Key using findings from all 4 stages.
        </p>

        <form onSubmit={handleInitialSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Verdict Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
              1. Incident Legitimacy Assessment:
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setVerdict('MALICIOUS')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: verdict === 'MALICIOUS' ? '#ff4d5e' : 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  border: `1px solid ${verdict === 'MALICIOUS' ? '#ff4d5e' : 'rgba(255,255,255,0.2)'}`,
                }}
              >
                MALICIOUS BREACH (Attack)
              </button>
              <button
                type="button"
                onClick={() => setVerdict('LEGITIMATE')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: verdict === 'LEGITIMATE' ? '#2ecc71' : 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  border: `1px solid ${verdict === 'LEGITIMATE' ? '#2ecc71' : 'rgba(255,255,255,0.2)'}`,
                }}
              >
                LEGITIMATE RECOVERY (Benign)
              </button>
            </div>
          </div>

          {/* Composite Incident Key */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
              2. Composite Incident Token (Format: VERDICT:ACCOUNT:IP:TIMESTAMP):
            </label>
            <input
              type="text"
              className="clue-input"
              style={{ width: '100%' }}
              placeholder="e.g. MALICIOUS:alex.chen:192.168.1.105:21:43"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              required
            />
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              Derived from: Verdict + Compromised Coordinator Username + Originating Host IP + Log Time
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="submit"
              className="submit-btn"
              disabled={!tokenInput.trim()}
              style={{ background: '#00c8e9', color: '#000000', fontWeight: 800 }}
            >
              Review & Submit Case
            </button>
          </div>
        </form>

        {/* Confirmation Modal Step */}
        {showConfirmDialog && (
          <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.92)' }}>
            <div className="modal-card" style={{ maxWidth: '480px', border: '2px solid #ffc933' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffc933' }}>
                ⚠️ Confirm Final Case Submission
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, margin: 0 }}>
                Once submitted, your team's investigation will be immediately scored, locked, and persisted to the database. You will not be able to modify your findings.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
                <div><strong>Selected Verdict:</strong> {verdict}</div>
                <div style={{ marginTop: '4px' }}><strong>Incident Token:</strong> {tokenInput}</div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#ffffff',
                    padding: '10px 18px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={handleFinalConfirm}
                  style={{
                    background: '#2ecc71',
                    border: 'none',
                    color: '#000000',
                    padding: '10px 22px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  Lock & Submit Incident Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
