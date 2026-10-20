import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import { createRunnerSocketClient } from '../gameSocketClient.js';
import HUD from './components/HUD.jsx';
import RunnerCanvas from './components/RunnerCanvas.jsx';
import ResultsModal from './components/ResultsModal.jsx';
import ConstellationCanvas from './components/ConstellationCanvas.jsx';
import MapGuidelinesModal from './components/MapGuidelinesModal.jsx';

function RunnerMonitor({
  playerId,
  teamId,
  gameState,
  roomStatus,
  result,
  rejectedNotice,
  telemetryLogs,
  handleAction,
  handleStartSprint,
  handleRestart,
  handleConnect,
}) {
  const feedContainerRef = useRef(null);
  const [restartAlert, setRestartAlert] = useState(null);
  const prevCollisionsRef = useRef(gameState?.collisionsCount || 0);

  const isWaiting = false;

  useEffect(() => {
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight;
    }
  }, [telemetryLogs]);

  useEffect(() => {
    const collisions = gameState?.collisionsCount || 0;
    const respNotice = gameState?.respawnNotice;

    if (collisions > prevCollisionsRef.current || (respNotice && !restartAlert)) {
      setRestartAlert({
        id: Date.now(),
        title: 'Collision Restart',
        subtext: respNotice || 'CRASHED INTO ROADBLOCK · RESET TO 0.0m · STOPWATCH RUNNING',
      });

      const timer = setTimeout(() => {
        setRestartAlert(null);
      }, 2500);

      prevCollisionsRef.current = collisions;
      return () => clearTimeout(timer);
    }

    prevCollisionsRef.current = collisions;
  }, [gameState?.collisionsCount, gameState?.respawnNotice, restartAlert]);

  return (
    <div className="participant-monitor-card" style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <HUD
        state={gameState}
        gameState={gameState}
        roomStatus={roomStatus}
        playerId={playerId}
        rejectedNotice={rejectedNotice}
        teamId={teamId}
      />

      <div className="canvas-frame-outer" style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <RunnerCanvas
          state={gameState}
          gameState={gameState}
          playerId={playerId}
          onAction={handleAction}
        />

        {restartAlert && (
          <div key={restartAlert.id} className="game-restarted-overlay">
            <div className="restarted-badge">
              <span className="restarted-icon">⚠️</span>
              <span className="restarted-title">{restartAlert.title || 'GAME RESTARTED'}</span>
            </div>
            <p className="restarted-subtext">
              {restartAlert.subtext || 'COLLISION DETECTED · RESET TO 0.0M · CLOCK RUNNING'}
            </p>
          </div>
        )}

        {isWaiting && (
          <div className="lobby-overlay-waiting" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '24px', textAlign: 'center' }}>
            <div className="waiting-spinner-core" style={{ width: '48px', height: '48px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#00c8e9', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff', letterSpacing: '0.5px' }}>
              AWAITING HIGHWAY SIGNAL
            </h2>
            <p style={{ maxWidth: '420px', color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Player 1 controls Vertical movements (Jump / Slide) while Player 2 controls Horizontal navigation (Left / Right lanes).
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="product-btn product-btn--primary"
                onClick={handleConnect}
                style={{ fontSize: '12px', padding: '8px 18px', background: '#00c8e9', color: '#000', fontWeight: 800 }}
              >
                Sync Device / Pair Now ⚡
              </button>
            </div>
          </div>
        )}

        {gameState?.status === 'READY' && !isWaiting && (
          <div className="launch-sprint-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9 }}>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', margin: '0 0 16px 0' }}>CYBER HIGHWAY SPRINT READY</h2>
            <button
              className="product-btn product-btn--primary"
              onClick={handleStartSprint}
              style={{ padding: '12px 32px', fontSize: '16px', fontWeight: 800, background: '#d4f04a', color: '#000' }}
            >
              LAUNCH RUNNER (3s COUNTDOWN) ▶
            </button>
          </div>
        )}
      </div>

      <div className="telemetry-deck-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div className="side-card" style={{ marginTop: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
              EXPEDITION CONTROLS — {playerId === 'P1' ? 'PLAYER 1 (VERTICAL: JUMP/SLIDE)' : 'PLAYER 2 (HORIZONTAL: LANES)'}
            </h3>
            <span style={{ fontSize: '11px', color: '#ffc933', fontWeight: 700 }}>
              TRICKY KEYS: A/←: RIGHT · D/→: LEFT · S/↓: JUMP · W/↑: SLIDE
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <button
              id="btn-runner-jump"
              className="interactive-control-btn"
              onClick={() => handleAction('P1', 'JUMP')}
              style={{ height: '48px', fontSize: '12px', fontWeight: 700 }}
            >
              ▲ JUMP (S / ↓)
            </button>
            <button
              id="btn-runner-slide"
              className="interactive-control-btn"
              onClick={() => handleAction('P1', 'SLIDE')}
              style={{ height: '48px', fontSize: '12px', fontWeight: 700 }}
            >
              ▼ SLIDE (W / ↑)
            </button>
            <button
              id="btn-runner-left"
              className="interactive-control-btn"
              onClick={() => handleAction('P2', 'LEFT')}
              style={{ height: '48px', fontSize: '12px', fontWeight: 700 }}
            >
              ◀ LEFT (D / →)
            </button>
            <button
              id="btn-runner-right"
              className="interactive-control-btn"
              onClick={() => handleAction('P2', 'RIGHT')}
              style={{ height: '48px', fontSize: '12px', fontWeight: 700 }}
            >
              ▶ RIGHT (A / ←)
            </button>
          </div>
        </div>

        <div className="side-card" style={{ flex: 1, minHeight: '110px' }}>
          <h3 style={{ fontSize: '12px', marginBottom: '6px', fontWeight: 700, color: '#ffffff' }}>
            LIVE HIGHWAY TELEMETRY
          </h3>
          <div ref={feedContainerRef} className="event-feed" style={{ maxHeight: '100px', overflowY: 'auto' }}>
            {telemetryLogs.length > 0 ? (
              telemetryLogs.slice(-5).map((log, i) => (
                <div key={i} className={`feed-item feed-${log.type}`} style={{ padding: '4px 0', fontSize: '11px', color: '#ffffff' }}>
                  <span>
                    <span className="feed-dot" style={{ background: '#00c8e9' }} />
                    {log.msg}
                  </span>
                  <time style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{log.time}</time>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', padding: '14px 0' }}>
                Awaiting sprint launch...
              </div>
            )}
          </div>
        </div>
      </div>

      {result && <ResultsModal result={result} onRestart={onBack || handleRestart} onBack={onBack} />}
    </div>
  );
}

export default function RunnerApp({
  teamId = 'CC-001',
  playerSlot = 'P1',
  onBack,
  onLogout,
  onSlotChange,
}) {
  const [currentSlot, setCurrentSlot] = useState(playerSlot);
  const [gameState, setGameState] = useState(null);
  const [roomStatus, setRoomStatus] = useState({ p1Connected: false, p2Connected: false });
  const [result, setResult] = useState(null);
  const [rejectedNotice, setRejectedNotice] = useState(null);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [showGuidelines, setShowGuidelines] = useState(true);

  const socketClientRef = useRef(null);

  useEffect(() => {
    setCurrentSlot(playerSlot);
  }, [playerSlot]);

  const addTelemetry = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setTelemetryLogs((prev) => [...prev.slice(-30), { msg, type, time }]);
  }, []);

  useEffect(() => {
    const client = createRunnerSocketClient({
      teamId,
      playerId: currentSlot,
      onTick: (state) => {
        setGameState(state);
      },
      onRoomStatus: (status) => {
        setRoomStatus(status);
        addTelemetry('Room status synchronized', 'system');
      },
      onGameOver: (finalResult) => {
        setResult(finalResult);
        addTelemetry('Finish line reached! Scoring complete.', 'success');
      },
      onRejected: (data) => {
        setRejectedNotice(data.reason);
        setTimeout(() => setRejectedNotice(null), 2000);
      },
    });

    socketClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [teamId, currentSlot, addTelemetry]);

  const handleAction = useCallback((role, action) => {
    if (!socketClientRef.current) return;
    socketClientRef.current.sendInput(action, role);
  }, []);

  const handleStartSprint = () => {
    if (socketClientRef.current) {
      socketClientRef.current.playGame(`runner_${teamId}`);
    }
  };

  const handleRestart = () => {
    setResult(null);
    if (socketClientRef.current) {
      socketClientRef.current.restartGame(`runner_${teamId}`);
    }
  };

  const handleConnect = () => {
    if (socketClientRef.current) {
      socketClientRef.current.simulatePartnerConnect(`runner_${teamId}`, 'BOTH');
    }
  };

  const toggleSlot = () => {
    const nextSlot = currentSlot === 'P1' ? 'P2' : 'P1';
    setCurrentSlot(nextSlot);
    if (onSlotChange) onSlotChange(nextSlot);
  };

  useEffect(() => {
    function handleKeyDown(e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat) return;

      if (gameState?.status === 'READY' && (e.key === ' ' || e.key === 'Enter')) {
        handleStartSprint();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'a' || key === 'arrowleft') {
        handleAction('P2', 'RIGHT');
      } else if (key === 'd' || key === 'arrowright') {
        handleAction('P2', 'LEFT');
      } else if (key === 's' || key === 'arrowdown' || key === ' ') {
        handleAction('P1', 'JUMP');
      } else if (key === 'w' || key === 'arrowup') {
        handleAction('P1', 'SLIDE');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction, gameState?.status]);

  return (
    <div className="runner-game-wrapper runner-app-wrapper">
      <ConstellationCanvas />

      <header className="dual-topbar-controls" style={{ padding: '12px 24px', background: '#0a1620', borderBottom: '1px solid rgba(0, 200, 233, 0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button className="product-btn product-btn--light" onClick={onBack} style={{ padding: '6px 14px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
              ← Dashboard
            </button>
          )}
          <div className="front-brand">
            <span className="front-tag" style={{ color: '#00c8e9', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>ROUND 01 / GAME 02</span>
            <h1 className="front-title" style={{ fontSize: '20px', margin: 0, color: '#ffffff', fontWeight: 800 }}>
              Cyber Runner
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(0, 200, 233, 0.1)',
              border: '1px solid rgba(0, 200, 233, 0.3)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#00c8e9',
              fontWeight: 700
            }}>
              TEAM: {teamId}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="product-btn"
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              color: '#d4f04a',
              background: 'rgba(212, 240, 74, 0.12)',
              border: '1px solid rgba(212, 240, 74, 0.4)',
              cursor: 'pointer',
            }}
            onClick={() => setShowGuidelines(true)}
          >
            📋 Guide
          </button>
          <button
            className="product-btn"
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              color: '#fff',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
            onClick={handleConnect}
          >
            ⚡ Sync Partner
          </button>
          {onLogout && (
            <button
              className="product-btn"
              onClick={onLogout}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#9fb8c2',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      <div className="single-monitor-container" style={{ padding: '20px 24px' }}>
        <RunnerMonitor
          playerId={currentSlot}
          teamId={teamId}
          gameState={gameState}
          roomStatus={roomStatus}
          result={result}
          rejectedNotice={rejectedNotice}
          telemetryLogs={telemetryLogs}
          handleAction={handleAction}
          handleStartSprint={handleStartSprint}
          handleRestart={handleRestart}
          handleConnect={handleConnect}
        />
      </div>

      <MapGuidelinesModal
        isOpen={showGuidelines}
        onClose={() => setShowGuidelines(false)}
      />
    </div>
  );
}
