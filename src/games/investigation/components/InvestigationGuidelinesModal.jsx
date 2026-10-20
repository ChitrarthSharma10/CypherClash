import React from 'react';

export default function InvestigationGuidelinesModal({ isOpen = true, onClose }) {
  if (!isOpen) return null;

  const scoringTable = [
    { wrong: '0 wrong answers', score: '500 PTS', desc: 'Flawless execution' },
    { wrong: '2 wrong answers', score: '470 PTS', desc: '-30 pts deducted' },
    { wrong: '4 wrong answers', score: '440 PTS', desc: '-60 pts deducted' },
    { wrong: '10 wrong answers', score: '350 PTS', desc: '-150 pts deducted' },
    { wrong: '24+ wrong answers', score: '150 PTS', desc: 'Guaranteed minimum floor' },
  ];

  return (
    <div className="guidelines-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="guidelines-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '740px',
          background: '#091520',
          border: '1px solid rgba(0, 200, 233, 0.4)',
          borderRadius: '12px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 200, 233, 0.1)',
          padding: '24px',
          color: '#e6f4f8',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🛡️</span>
            <div>
              <span style={{ color: '#00c8e9', fontSize: '11px', fontWeight: 800, letterSpacing: '1px' }}>
                ROUND 03 / TOURNAMENT RULES
              </span>
              <h2 style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                Digital Detective: Scoring & Operation Rules
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* 4 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(0, 200, 233, 0.06)', border: '1px solid rgba(0, 200, 233, 0.25)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 700, textTransform: 'uppercase' }}>Maximum Score</div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#2ecc71', margin: '4px 0' }}>500</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>All 4 clues completed</div>
          </div>

          <div style={{ background: 'rgba(255, 77, 94, 0.06)', border: '1px solid rgba(255, 77, 94, 0.25)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#ff4d5e', fontWeight: 700, textTransform: 'uppercase' }}>Wrong Submission</div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#ff4d5e', margin: '4px 0' }}>-15</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Per incorrect submission</div>
          </div>

          <div style={{ background: 'rgba(212, 240, 74, 0.06)', border: '1px solid rgba(212, 240, 74, 0.25)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#d4f04a', fontWeight: 700, textTransform: 'uppercase' }}>Min. Completion</div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#d4f04a', margin: '4px 0' }}>150</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Floor for completed round</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase' }}>Round Duration</div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>45 <span style={{ fontSize: '13px' }}>min</span></div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>2700 seconds cap</div>
          </div>
        </div>

        {/* Scoring Formula Box */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(0, 200, 233, 0.3)',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#00c8e9', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Official Scoring Formula
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>
            Score = max(150, 500 − 15W)
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5 }}>
            यहाँ <strong>W</strong> का मतलब <em>wrong submissions</em> (incorrect decryption attempts or false accusations) की संख्या है। यह score तभी मिलेगा जब <strong>सभी 4 clues</strong> successfully complete हों और दोनों roles accusation approve करें।
          </p>
        </div>

        {/* Two-Column Section: Roles & Score Progression Table */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          {/* Cooperative Roles */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#00c8e9', fontWeight: 800, textTransform: 'uppercase' }}>
              Cooperative Roles
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ borderLeft: '3px solid #00c8e9', paddingLeft: '10px' }}>
                <strong style={{ color: '#ffffff', display: 'block' }}>Lead Detective (Field Operations)</strong>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Claims room, shares private invite link, and adds physical security logs (`EV-001`, `EV-002`, `EV-003`).
                </span>
              </div>
              <div style={{ borderLeft: '3px solid #d4f04a', paddingLeft: '10px' }}>
                <strong style={{ color: '#ffffff', display: 'block' }}>Forensic Analyst (Network Telemetry)</strong>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Joins via private link and decrypts cryptographic packet payloads (`EV-004`).
                </span>
              </div>
              <div style={{ borderLeft: '3px solid #f39c12', paddingLeft: '10px' }}>
                <strong style={{ color: '#ffffff', display: 'block' }}>Dual-Indictment Approval</strong>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Either player can file an accusation citing evidence; the other player must review and approve it to finalize the case.
                </span>
              </div>
            </div>
          </div>

          {/* Performance Table */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#00c8e9', fontWeight: 800, textTransform: 'uppercase' }}>
              Score Progression Reference
            </h4>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'rgba(255,255,255,0.5)' }}>
                  <th style={{ padding: '4px 0' }}>Team Performance</th>
                  <th style={{ padding: '4px 0', textAlign: 'right' }}>Final Score</th>
                </tr>
              </thead>
              <tbody>
                {scoringTable.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '6px 0', color: 'rgba(255,255,255,0.85)' }}>
                      {row.wrong}
                      <span style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{row.desc}</span>
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: idx === 0 ? '#2ecc71' : idx === scoringTable.length - 1 ? '#d4f04a' : '#00c8e9' }}>
                      {row.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Action */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            className="product-btn"
            style={{
              background: '#00c8e9',
              color: '#050d14',
              border: 0,
              padding: '10px 32px',
              fontWeight: 800,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            I Understand — Proceed to Case
          </button>
        </div>
      </div>
    </div>
  );
}
