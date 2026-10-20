export default function GameManualModal({ isOpen, onClose, onPlay }) {
  if (!isOpen) return null;

  return (
    <div className="manual-overlay" onClick={onClose}>
      <div className="manual-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="manual-header">
          <div className="manual-badge">GUIDE</div>
          <h2>RULES & SYMBOLS</h2>
          <button className="manual-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Minimalist Body */}
        <div className="manual-body">
          {/* Section 1: Objective & Roles */}
          <div className="manual-section">
            <h3 className="section-title">CO-OP ROLES</h3>
            <div className="roles-breakdown-box">
              <div className="role-rule-col">
                <div className="role-rule-header">
                  <strong>PLAYER 1 (VERTICAL)</strong>
                </div>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <kbd>W</kbd> : <strong>JUMP</strong> over hurdles<br />
                  <kbd>S</kbd> : <strong>SLIDE</strong> under overhead signs
                </p>
              </div>

              <div className="role-rule-col">
                <div className="role-rule-header">
                  <strong>PLAYER 2 (LANES)</strong>
                </div>
                <p style={{ margin: '6px 0', fontSize: '13px' }}>
                  <kbd>A</kbd> : <strong>LEFT</strong> lane<br />
                  <kbd>D</kbd> : <strong>RIGHT</strong> lane
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Symbols Legend */}
          <div className="manual-section">
            <h3 className="section-title">SYMBOLS & ITEMS</h3>
            <div className="symbol-legend-grid">
              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">🪙</span>
                  <span className="sym-pts">+25 PTS</span>
                </div>
                <h4>Gold Bar</h4>
                <p>Bullion along tracks</p>
              </div>

              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">📦</span>
                  <span className="sym-pts">+150 PTS</span>
                </div>
                <h4>Vault</h4>
                <p>Bonus safe recovery</p>
              </div>

              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">🏁</span>
                  <span className="sym-pts">+100 PTS</span>
                </div>
                <h4>Sector Gate</h4>
                <p>Checkpoints every 300m</p>
              </div>

              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">🧲</span>
                  <span className="sym-timer">8 SECONDS</span>
                </div>
                <h4>Magnet</h4>
                <p>Draws gold across lanes</p>
              </div>

              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">🛡️</span>
                  <span className="sym-timer">10 SECONDS</span>
                </div>
                <h4>Shield</h4>
                <p>Absorbs 1 collision</p>
              </div>

              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">⚡</span>
                  <span className="sym-timer">8 SECONDS</span>
                </div>
                <h4>2X Multiplier</h4>
                <p>Doubles gold value</p>
              </div>

              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">🚧</span>
                  <span className="sym-action">JUMP (W)</span>
                </div>
                <h4>Hurdle</h4>
                <p>P1 Jump</p>
              </div>

              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">🚸</span>
                  <span className="sym-action">SLIDE (S)</span>
                </div>
                <h4>Sign</h4>
                <p>P1 Slide</p>
              </div>

              <div className="symbol-item-card">
                <div className="symbol-badge">
                  <span className="sym-icon">🚚</span>
                  <span className="sym-action">STEER (A/D)</span>
                </div>
                <h4>Truck</h4>
                <p>P2 Lane Switch</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="manual-footer">
          <button className="front-btn-secondary" onClick={onClose}>
            CLOSE
          </button>
          {onPlay && (
            <button
              className="play-game-big-btn"
              style={{ padding: '10px 24px', fontSize: '13px' }}
              onClick={() => {
                onClose();
                onPlay();
              }}
            >
              PLAY (0M)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
