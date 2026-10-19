import ConstellationCanvas from './ConstellationCanvas.jsx';

export default function FrontLobbyScreen({
  gameTag = 'ROUND 01',
  gameTitle = 'Dual Maze Runner',
  roomStatus = { p1Connected: false, p2Connected: false },
  role = 'P1',
  onSwitchRole,
  onOpenPartner,
  onOpenManual,
  timeDisplay = '— : —',
  noticeText = 'Connection in progress. Reconnecting automatically...',
  heroTitle = 'Reconnecting to the maze runner...',
  heroDesc = 'Your session and game state will be restored automatically.',
}) {
  return (
    <div className="front-lobby-shell">
      {/* Animated Constellation Nodes Background */}
      <ConstellationCanvas />

      <div className="front-lobby-content">
        {/* Top Header */}
        <header className="front-topbar">
          <div className="front-brand">
            <span className="front-tag">{gameTag}</span>
            <h1 className="front-title">
              {gameTitle} <span className="front-slash">/</span>
            </h1>
          </div>

          <div className="front-topbar-right">
            <div className="front-status-indicator">
              <span className="front-pulsing-dot" />
              <span>RECONNECTING</span>
            </div>
            <button
              className="front-back-btn"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Dashboard
            </button>
          </div>
        </header>

        {/* Notice Bar */}
        <div className="front-notice-bar">{noticeText}</div>

        {/* Round Status Meta Bar */}
        <div className="front-meta-bar">
          <div className="front-meta-col left">ROUND STATUS</div>
          <div className="front-meta-col center">{timeDisplay}</div>
          <div className="front-meta-col right">CONNECTING</div>
        </div>

        {/* Central Hero Card */}
        <main className="front-hero-card">
          <h2 className="front-hero-title">{heroTitle}</h2>
          <p className="front-hero-desc">{heroDesc}</p>

          {/* Connection Status Row */}
          <div className="front-players-status">
            <div className={`front-player-pill ${roomStatus.p1Connected ? 'connected' : 'waiting'}`}>
              <span className="pill-dot" />
              <span>PLAYER 1: {roomStatus.p1Connected ? 'READY' : 'WAITING'}</span>
            </div>
            <div className={`front-player-pill ${roomStatus.p2Connected ? 'connected' : 'waiting'}`}>
              <span className="pill-dot" />
              <span>PLAYER 2: {roomStatus.p2Connected ? 'READY' : 'WAITING'}</span>
            </div>
          </div>

          {/* Quick Connection Action Buttons */}
          <div className="front-actions-row">
            {onSwitchRole && (
              <button
                className="front-btn-primary"
                onClick={() => onSwitchRole('SHARED')}
              >
                Play Together (Shared Screen)
              </button>
            )}

            {onOpenPartner && (
              <button
                className="front-btn-secondary"
                onClick={onOpenPartner}
              >
                Open Partner Tab ({role === 'P1' ? 'P2' : 'P1'})
              </button>
            )}

            {onOpenManual && (
              <button
                className="front-btn-secondary"
                onClick={onOpenManual}
              >
                Rules & Symbols
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
