export default function DevControls({
  auth,
  currentRole,
  onSwitchRole,
  onAdminAction,
  onSwitchMaze,
  activeMaze,
}) {
  const otherRole = currentRole === 'P1' ? 'P2' : 'P1';

  function openPartnerTab() {
    const url = new URL(window.location.href);
    url.searchParams.set('playerId', otherRole);
    url.searchParams.set('dev', '1');
    url.searchParams.set('teamId', auth.teamId);
    url.searchParams.set('sessionId', auth.sessionId);
    window.open(url.toString(), '_blank');
  }

  return (
    <div className="dev-controls-bar" style={{ background: 'rgba(255, 42, 68, 0.08)', borderColor: 'rgba(255, 42, 68, 0.35)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="dev-title" style={{ color: '#ff2a44' }}>SIMULATOR</span>
        <span style={{ color: '#ffffff' }}>
          ROLE: <strong style={{ color: '#ff2a44' }}>{currentRole}</strong>
        </span>
      </div>

      <div className="dev-actions">
        {/* Role Toggle */}
        <button
          className="dev-btn"
          style={{ borderColor: 'rgba(255, 42, 68, 0.45)', color: '#ffffff' }}
          onClick={() => onSwitchRole(otherRole)}
          title="Switch role"
        >
          Switch to {otherRole}
        </button>

        {/* Open 2nd Player Window */}
        <button
          className="dev-btn"
          style={{ borderColor: 'rgba(255, 42, 68, 0.45)', color: '#ffffff' }}
          onClick={openPartnerTab}
          title="Open second player tab"
        >
          Open {otherRole} Tab ↗
        </button>

        {/* Maze Selector */}
        <select
          value={activeMaze}
          onChange={(e) => onSwitchMaze(e.target.value)}
          style={{
            background: '#14141c',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '12px',
            fontFamily: 'var(--cc-font-body)',
            fontWeight: 500,
          }}
        >
          <option value="maze-alpha">Alpha</option>
          <option value="maze-beta">Beta</option>
          <option value="maze-gamma">Gamma</option>
        </select>

        {/* Admin Controls */}
        <button className="dev-btn" onClick={() => onAdminAction('pause')} style={{ color: '#ffffff' }}>Pause</button>
        <button className="dev-btn" onClick={() => onAdminAction('resume')} style={{ color: '#ffffff' }}>Resume</button>
        <button className="dev-btn" onClick={() => onAdminAction('reset')} style={{ color: '#ff2a44' }}>Reset</button>
      </div>
    </div>
  );
}
