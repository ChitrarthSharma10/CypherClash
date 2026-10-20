import React from 'react';
import { setRole } from '../mockAuth.js';

export default function DevControls({
  isDevMode,
  playerId,
  onSimulateConnect,
  dbStatus = 'mongodb-atlas',
}) {
  if (!isDevMode) return null;

  const isFallback = dbStatus.includes('in-memory') || dbStatus.includes('offline');

  return (
    <div className="dev-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontWeight: 800, color: '#ffc933' }}>[DEV MODE ACTIVE]</span>
        <span>Current Device View: <strong>Player {playerId}</strong></span>
        <button
          type="button"
          onClick={() => setRole(playerId === 'P1' ? 'P2' : 'P1')}
          style={{
            background: '#ffffff',
            color: '#000000',
            border: 'none',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Switch to Player {playerId === 'P1' ? '2' : '1'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          background: isFallback ? 'rgba(255, 77, 94, 0.2)' : 'rgba(46, 204, 113, 0.2)',
          color: isFallback ? '#ff4d5e' : '#2ecc71',
          border: `1px solid ${isFallback ? 'rgba(255, 77, 94, 0.5)' : 'rgba(46, 204, 113, 0.5)'}`,
        }}>
          DB: {dbStatus}
        </span>

        <button
          type="button"
          onClick={() => onSimulateConnect && onSimulateConnect()}
          style={{
            background: 'rgba(0, 200, 233, 0.2)',
            color: '#00c8e9',
            border: '1px solid #00c8e9',
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Simulate Partner Connect
        </button>
      </div>
    </div>
  );
}
