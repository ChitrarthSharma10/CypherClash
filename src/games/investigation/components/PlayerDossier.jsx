import React, { useState } from 'react';

export default function PlayerDossier({ dossier, dossiers, playerId = 'P1' }) {
  const [selectedRole, setSelectedRole] = useState('P1');
  const [activeArtifactIndex, setActiveArtifactIndex] = useState(0);

  const activeDossier = dossiers ? (dossiers[selectedRole] || dossier) : dossier;

  if (!activeDossier) {
    return (
      <div className="dossier-panel-wrapper">
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>Role Dossier</h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>
          Loading role-restricted intelligence...
        </p>
      </div>
    );
  }

  const artifacts = activeDossier.artifacts || [];
  const currentArtifact = artifacts[activeArtifactIndex] || artifacts[0];

  const roleTitle = selectedRole === 'P1' ? 'PLAYER 1 (COMMUNICATIONS & METADATA)' : 'PLAYER 2 (INFRASTRUCTURE & SIEM)';

  return (
    <div className="dossier-panel-wrapper">
      {/* Header Row */}
      <div className="dossier-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div className="dossier-brand-stack">
            <span>Role</span>
            <span>Dossier</span>
          </div>
          <h2 className="dossier-role-title">{roleTitle}</h2>
        </div>
        <span className="dossier-restricted-badge">TWO-PLAYER CO-OP</span>
      </div>

      {/* Role Switcher for Single System Collaboration */}
      {dossiers && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <button
            type="button"
            className={`artifact-pill-btn ${selectedRole === 'P1' ? 'active' : ''}`}
            onClick={() => { setSelectedRole('P1'); setActiveArtifactIndex(0); }}
            style={{ fontWeight: 700, fontSize: '11px', padding: '6px 10px' }}
          >
            PARTICIPANT 1 INTEL (EMAILS / PAYLOADS)
          </button>
          <button
            type="button"
            className={`artifact-pill-btn ${selectedRole === 'P2' ? 'active' : ''}`}
            onClick={() => { setSelectedRole('P2'); setActiveArtifactIndex(0); }}
            style={{ fontWeight: 700, fontSize: '11px', padding: '6px 10px' }}
          >
            PARTICIPANT 2 INTEL (SIEM / NETFLOW)
          </button>
        </div>
      )}

      {/* Focus Area Subtext */}
      <div className="dossier-focus-area">
        <strong>Focus Area:</strong> {activeDossier.focusArea}
      </div>

      {/* Artifact Pills Navigation */}
      <div className="artifact-pills-row">
        {artifacts.map((art, idx) => {
          const isActive = activeArtifactIndex === idx;
          return (
            <button
              key={art.id || idx}
              type="button"
              className={`artifact-pill-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveArtifactIndex(idx)}
            >
              Artifact #{idx + 1}
            </button>
          );
        })}
      </div>

      {/* Active Artifact Inspection */}
      {currentArtifact && (
        <div className="artifact-body-card">
          <h3 className="artifact-heading">{currentArtifact.name}</h3>
          <p className="artifact-subtext">{currentArtifact.summary}</p>

          {/* Monospace Code Terminal Box */}
          <pre className="artifact-terminal-box">
            {currentArtifact.snippet}
          </pre>
        </div>
      )}

      {/* Collaborative Tip Footer */}
      <div className="dossier-collab-tip">
        <span>
          💡 <em>Collaborative Tip:</em> Communicate findings verbally with your partner device. Your partner has different evidence regarding this same timeline.
        </span>
        <span className="sparkle-glyph">✦</span>
      </div>
    </div>
  );
}
