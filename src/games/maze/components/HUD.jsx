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

  const p1Connected = current?.players?.P1?.connected;
  const p2Connected = current?.players?.P2?.connected;
  const isMeP1 = playerId === 'P1';

  const collectedCount = current?.collectibles?.filter((c) => c.collected).length ?? 0;
  const totalCollectibles = current?.collectibles?.length ?? 8;

  const checkpointsPassed = current?.checkpoints?.filter((cp) => cp.passed).length ?? 0;
  const totalCheckpoints = current?.checkpoints?.length ?? 3;

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
    <div className="hud-grid" style={{ marginBottom: '14px' }}>
      {/* 1. Timer Card */}
      <div className="hud-card">
        <div className="hud-label" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          TIME (STOPWATCH)
        </div>
        <div className="hud-value" style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
          {mins}:{secs}
        </div>
        <div className="hud-status-badge" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          TIME ELAPSED
        </div>
      </div>

      {/* 2. Score & Penalty Card (With Dynamic Green/Red Animation) */}
      <div className="hud-card" style={{ position: 'relative', overflow: 'visible' }}>
        {floatingNotice && (
          <div
            key={floatingNotice.key}
            className={`floating-score-tag ${floatingNotice.type === 'add' ? 'score-green' : 'score-red'}`}
          >
            {floatingNotice.text}
          </div>
        )}
        <div className="hud-label" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          SCORE
        </div>
        <div
          className={`hud-value ${scoreAnimClass}`}
          style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', margin: '4px 0', transition: 'color 0.2s' }}
        >
          {score} <span style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 700 }}>PTS</span>
        </div>
        <div className="hud-status-badge" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          {penalties > 0 ? `-${penalties} PTS (${collisionsCount} HITS)` : `${collisionsCount} HITS`}
        </div>
      </div>

      {/* 3. Your Assigned Role Card */}
      <div className="hud-card">
        <div className="hud-label" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          ROLE
        </div>
        <div className="hud-value" style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
          TWO-PLAYER CO-OP
        </div>
        <div className="hud-status-badge" style={{ fontSize: '11px', fontWeight: 700, color: '#ffc933' }}>
          KEYS: A=RIGHT · D=LEFT · S=UP · W=DOWN
        </div>
      </div>

      {/* 4. Team Status & Relays */}
      <div className="hud-card">
        <div className="hud-label" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          STATUS
        </div>
        <div className="hud-value" style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
          ACTIVE
        </div>
        <div className="hud-status-badge" style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>
          CORN: <strong style={{ color: '#ffffff' }}>{collectedCount}/{totalCollectibles}</strong> · NESTS: <strong style={{ color: '#ffffff' }}>{checkpointsPassed}/{totalCheckpoints}</strong>
        </div>
      </div>
    </div>
  );
}
