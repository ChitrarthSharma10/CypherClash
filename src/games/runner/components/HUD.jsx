import { useState, useEffect, useRef } from 'react';

export default function HUD({ state, gameState, playerId }) {
  const current = state || gameState;
  const timeElapsedMs = current?.timeElapsedMs ?? 0;
  const totalSeconds = Math.max(0, Math.floor(timeElapsedMs / 1000));
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');

  const score = current?.score ?? 0;
  const penalties = current?.penalties ?? 0;
  const collisionsCount = current?.collisionsCount ?? 0;
  const distanceMeters = current?.distanceMeters ?? 0;
  const courseLengthMeters = current?.courseLengthMeters ?? 1000;
  const goldBarsCollected = current?.goldBarsCollected ?? current?.coinsCollected ?? 0;
  const checkpointsPassed = current?.checkpointsPassed ?? 0;
  const totalCheckpoints = current?.totalCheckpoints ?? 3;
  const respawnNotice = current?.respawnNotice;

  const activePowerUps = current?.activePowerUps ?? {};
  const magnetSec = activePowerUps.magnetTimer ?? 0;
  const doubleGoldSec = activePowerUps.doubleGoldTimer ?? 0;
  const shieldSec = activePowerUps.shieldTimer ?? 0;

  const isMeP1 = playerId === 'P1';
  const speedTier = current?.speedTier ?? 1;
  const speed = current?.speed ?? 16.0;
  const nextSurgeSec = current?.nextSurgeSec ?? 0;

  // Dynamic Score Animation State
  const prevScoreRef = useRef(score);
  const [floatingNotice, setFloatingNotice] = useState(null);
  const [scoreAnimClass, setScoreAnimClass] = useState('');

  useEffect(() => {
    if (prevScoreRef.current !== score) {
      const diff = score - prevScoreRef.current;
      prevScoreRef.current = score;

      if (diff > 0) {
        setFloatingNotice({ text: `+${diff} PTS`, type: 'add', key: Date.now() });
        setScoreAnimClass('score-bump-green');
      } else if (diff < 0) {
        setFloatingNotice({ text: `${diff} PTS`, type: 'deduct', key: Date.now() });
        setScoreAnimClass('score-shake-red');
      }

      const animTimer = setTimeout(() => {
        setScoreAnimClass('');
      }, 600);

      const hideTimer = setTimeout(() => {
        setFloatingNotice(null);
      }, 1200);

      return () => {
        clearTimeout(animTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [score]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
      {/* Collision restart alert notice */}
      {respawnNotice && (
        <div style={{
          background: 'rgba(255, 42, 68, 0.15)',
          border: '1px solid #ff2a44',
          borderRadius: '6px',
          padding: '8px 12px',
          textAlign: 'center',
          fontFamily: 'var(--cc-font-mono)',
          fontSize: '12px',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.05em',
          animation: 'pulse 1s infinite'
        }}>
          {respawnNotice}
        </div>
      )}

      {/* 4 Minimalist Metric Cards */}
      <div className="hud-grid">
        {/* 1. Time & Speed */}
        <div className="hud-card">
          <div className="hud-label">TIME (STOPWATCH)</div>
          <div className="hud-value" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>{mins}:{secs}</span>
            <span style={{ fontSize: '15px', color: '#ffffff', fontWeight: 700 }}>
              {speed} m/s
            </span>
          </div>
          <div className="hud-status-badge" style={{ color: '#ffffff' }}>
            {speedTier === 3 ? 'TIER 3 (MAX SPEED)' : nextSurgeSec > 0 ? `TIER ${speedTier} · +SPEED IN ${nextSurgeSec}s` : 'TIER 1 (BASE)'}
          </div>
        </div>

        {/* 2. Score & Gold (With Dynamic Floating Animation) */}
        <div className="hud-card" style={{ position: 'relative', overflow: 'visible' }}>
          {floatingNotice && (
            <div
              key={floatingNotice.key}
              className={`floating-score-tag ${floatingNotice.type === 'add' ? 'score-green' : 'score-red'}`}
            >
              {floatingNotice.text}
            </div>
          )}
          <div className="hud-label">SCORE</div>
          <div
            className={`hud-value ${scoreAnimClass}`}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', transition: 'color 0.2s' }}
          >
            <span>{score}</span>
            <span style={{ fontSize: '15px', color: '#ffffff' }}>🪙 {goldBarsCollected}</span>
          </div>
          <div className="hud-status-badge" style={{ color: '#ffffff' }}>
            {penalties > 0 ? `-${penalties} PTS (${collisionsCount} CRASHES)` : '0 CRASHES'}
          </div>
        </div>

        {/* 3. Controls / Role */}
        <div className="hud-card">
          <div className="hud-label">ROLE</div>
          <div className="hud-value" style={{ fontSize: '18px', fontWeight: 800 }}>
            TWO-PLAYER CO-OP
          </div>
          <div className="hud-status-badge" style={{ color: '#ffc933', fontWeight: 700 }}>
            A=RIGHT · D=LEFT · S=JUMP · W=SLIDE
          </div>
        </div>

        {/* 4. Distance & Sector Gates */}
        <div className="hud-card">
          <div className="hud-label">FINISH LINE</div>
          <div className="hud-value" style={{ fontSize: '22px' }}>
            {Math.round(distanceMeters)} <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>/ {courseLengthMeters}m</span>
          </div>
          <div className="hud-status-badge" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
            GATES: <strong style={{ color: '#ffffff' }}>{checkpointsPassed}/{totalCheckpoints}</strong>
          </div>
        </div>
      </div>

      {/* Active Power-Ups Row matching designated guidelines symbols */}
      {(magnetSec > 0 || doubleGoldSec > 0 || shieldSec > 0) && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {magnetSec > 0 && (
            <span className="powerup-pill">
              🧲 MAGNET {magnetSec.toFixed(1)}s
            </span>
          )}
          {doubleGoldSec > 0 && (
            <span className="powerup-pill">
              ⭐ 2X STAR {doubleGoldSec.toFixed(1)}s
            </span>
          )}
          {shieldSec > 0 && (
            <span className="powerup-pill">
              🛡️ SHIELD BUBBLE {shieldSec.toFixed(1)}s
            </span>
          )}
        </div>
      )}
    </div>
  );
}
