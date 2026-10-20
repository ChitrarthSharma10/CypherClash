export default function DevControls({ auth, currentRole, onSwitchRole, onAdminAction }) {
  const openPartnerTab = () => {
    onSwitchRole('P1');
    const partnerUrl = `${window.location.origin}${window.location.pathname}?teamId=${auth.teamId}&sessionId=${auth.sessionId}&playerId=P2&dev=1`;
    window.open(partnerUrl, '_blank');
  };

  return (
    <div className="dev-banner" style={{ background: 'rgba(255, 42, 68, 0.08)', borderColor: 'rgba(255, 42, 68, 0.35)' }}>
      <div className="dev-title" style={{ color: '#ff2a44' }}>
        SIMULATOR · [P1: UP/DOWN · P2: LEFT/RIGHT]
      </div>
      <div className="dev-actions">
        <span style={{ fontSize: '11px', color: '#ffffff' }}>MODE:</span>
        <button
          className={`dev-btn ${currentRole === 'SHARED' ? 'active' : ''}`}
          onClick={() => onSwitchRole('SHARED')}
          style={currentRole === 'SHARED' ? { background: '#ff2a44', color: '#ffffff', fontWeight: 'bold' } : { color: '#ffffff' }}
        >
          Shared
        </button>
        <button
          className={`dev-btn ${currentRole === 'P1' ? 'active' : ''}`}
          onClick={() => onSwitchRole('P1')}
          style={currentRole === 'P1' ? { background: '#ff2a44', color: '#ffffff', fontWeight: 'bold' } : { color: '#ffffff' }}
        >
          P1 Only
        </button>
        <button
          className={`dev-btn ${currentRole === 'P2' ? 'active' : ''}`}
          onClick={() => onSwitchRole('P2')}
          style={currentRole === 'P2' ? { background: '#ff2a44', color: '#ffffff', fontWeight: 'bold' } : { color: '#ffffff' }}
        >
          P2 Only
        </button>
        <button className="dev-btn" onClick={openPartnerTab} style={{ color: '#ffffff' }}>
          Split Tabs
        </button>
        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.2)', margin: '0 4px' }} />
        <button className="dev-btn" onClick={() => onAdminAction('pause')} style={{ color: '#ffffff' }}>Pause</button>
        <button className="dev-btn" onClick={() => onAdminAction('resume')} style={{ color: '#ffffff' }}>Resume</button>
        <button className="dev-btn" onClick={() => onAdminAction('reset')} style={{ color: '#ff2a44' }}>Reset</button>
      </div>
    </div>
  );
}
