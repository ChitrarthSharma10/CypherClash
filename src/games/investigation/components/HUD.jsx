import React, { useState, useEffect, useRef } from 'react';

export default function HUD({
  timeRemainingMs = 300000,
  score = 0,
  penalties = 0,
  currentStage = 1,
  stagesCompleted = [false, false, false, false],
  cooldownRemainingMs = 0,
  wrongAttemptsCurrentStage = 0,
  maxWrongAttempts = 3,
  playerId = 'P1',
  p1Connected = false,
  p2Connected = false,
  connectionsCount = 0,
}) {
  const isMeP1 = playerId === 'P1';

  // Stopwatch / Countdown formatting
  const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');

  // Stages completed count
  const clearedCount = stagesCompleted.filter(Boolean).length;

  // Dynamic Floating Score Tag & animations
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
        <div
          className="hud-value"
          style={{
            fontSize: '32px',
            fontWeight: 800,
            color: timeRemainingMs < 60000 ? '#ff4d5e' : '#ffffff',
            margin: '4px 0',
          }}
        >
          {mins}:{secs}
        </div>
        <div className="hud-status-badge" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          {timeRemainingMs < 60000 ? 'CRITICAL TIME' : 'TIME REMAINING'}
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
          {cooldownRemainingMs > 0
            ? `COOLDOWN (${Math.ceil(cooldownRemainingMs / 1000)}s)`
            : currentStage <= 4
            ? `STAGE ${currentStage}/4 · ${wrongAttemptsCurrentStage}/${maxWrongAttempts} ATTEMPTS`
            : 'FINAL STAGE READY'}
        </div>
      </div>

      {/* 3. Your Assigned Role Card */}
      <div className="hud-card">
        <div className="hud-label" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          ROLE
        </div>
        <div className="hud-value" style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
          {isMeP1 ? 'PLAYER 1' : 'PLAYER 2'}
        </div>
        <div className="hud-status-badge" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)' }}>
          {isMeP1 ? 'COMMUNICATIONS & METADATA' : 'SIEM & NETWORK LOGS'}
        </div>
      </div>

      {/* 4. Team Status & Investigation Progress */}
      <div className="hud-card">
        <div className="hud-label" style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.04em' }}>
          STATUS
        </div>
        <div className="hud-value" style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
          {p1Connected && p2Connected ? 'SYNCED' : 'WAITING'}
        </div>
        <div className="hud-status-badge" style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff' }}>
          CLUES: <strong style={{ color: '#ffffff' }}>{clearedCount}/4</strong> · LINKS: <strong style={{ color: '#ffffff' }}>{connectionsCount}</strong>
        </div>
      </div>
    </div>
  );
}
