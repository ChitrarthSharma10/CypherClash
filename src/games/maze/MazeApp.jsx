import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import { createMazeSocketClient } from '../gameSocketClient.js';
import HUD from './components/HUD.jsx';
import MazeCanvas from './components/MazeCanvas.jsx';
import ResultsModal from './components/ResultsModal.jsx';
import ConstellationCanvas from './components/ConstellationCanvas.jsx';
import MapGuidelinesModal from './components/MapGuidelinesModal.jsx';

function MazeMonitor({
  playerId,
  teamId,
  gameState,
  roomStatus,
  result,
  rejectedNotice,
  sendInput,
  handleRestart,
  handleConnect,
}) {
  const isP1 = playerId === 'P1';
  const partnerRole = isP1 ? 'Participant 2 (Horizontal)' : 'Participant 1 (Vertical)';
  const partnerConnected = isP1 ? roomStatus.p2Connected : roomStatus.p1Connected;
  const isWaiting = !roomStatus.p1Connected || !roomStatus.p2Connected;

  const activeTimersRef = useRef({});
  const pressStartRef = useRef({});

  const prevRestartsRef = useRef(0);
  const [restartAlert, setRestartAlert] = useState(null);

  useEffect(() => {
    const restarts = gameState?.restartsCount || 0;
    const respNotice = gameState?.respawnNotice;

    if (restarts > prevRestartsRef.current || (respNotice && !restartAlert)) {
      setRestartAlert({
        id: Date.now(),
        title: 'Game Restarted',
        subtext: respNotice || 'FELL INTO PIT TRAP · RESET TO START · CLOCK RUNNING',
      });

      const timer = setTimeout(() => {
        setRestartAlert(null);
      }, 2400);

      prevRestartsRef.current = restarts;
      return () => clearTimeout(timer);
    }

    prevRestartsRef.current = restarts;
  }, [gameState?.restartsCount, gameState?.respawnNotice, restartAlert]);

  const prevPortalCountRef = useRef(0);
  const [portalAlert, setPortalAlert] = useState(null);

  useEffect(() => {
    const portalCount = gameState?.portalAlertCount || 0;
    const pNotice = gameState?.portalNotice;

    if (portalCount > prevPortalCountRef.current || (pNotice && !portalAlert)) {
      setPortalAlert({
        id: Date.now(),
        title: 'DOOR UNLOCKED',
        subtext: pNotice || '⚡ RUNE PORTAL ACTIVATED · PORTCULLIS OPENED',
      });

      const timer = setTimeout(() => {
        setPortalAlert(null);
      }, 2600);

      prevPortalCountRef.current = portalCount;
      return () => clearTimeout(timer);
    }

    prevPortalCountRef.current = portalCount;
  }, [gameState?.portalAlertCount, gameState?.portalNotice, portalAlert]);

  const startMove = (role, axis, dir) => {
    if (activeTimersRef.current[axis]) {
      clearTimeout(activeTimersRef.current[axis]);
      delete activeTimersRef.current[axis];
    }
    pressStartRef.current[axis] = Date.now();
    sendInput(role, axis, dir);
  };

  const stopMove = (role, axis) => {
    const pressDuration = Date.now() - (pressStartRef.current[axis] || 0);
    if (pressDuration < 160) {
      if (activeTimersRef.current[axis]) clearTimeout(activeTimersRef.current[axis]);
      activeTimersRef.current[axis] = setTimeout(() => {
        sendInput(role, axis, 0);
        delete activeTimersRef.current[axis];
      }, 260 - pressDuration);
    } else {
      sendInput(role, axis, 0);
    }
  };

  return (
    <div className="participant-monitor-card" style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <HUD
        gameState={gameState}
        roomStatus={roomStatus}
        playerId={playerId}
        rejectedNotice={rejectedNotice}
        teamId={teamId}
      />

      <div className="canvas-frame-outer" style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <MazeCanvas
          gameState={gameState}
          playerId={playerId}
          onSendInput={sendInput}
        />

        {restartAlert && (
          <div className="pit-fall-alert-banner">
            <div className="pit-fall-pulse" />
            <div className="pit-fall-icon">⚠️</div>
            <div className="pit-fall-text-col">
              <span className="pit-fall-title">{restartAlert.title}</span>
              <span className="pit-fall-desc">{restartAlert.subtext}</span>
            </div>
          </div>
        )}

        {portalAlert && (
          <div className="door-unlock-banner">
            <div className="door-unlock-pulse" />
            <div className="door-unlock-icon">⚡</div>
            <div className="door-unlock-text-col">
              <span className="door-unlock-title">{portalAlert.title}</span>
              <span className="door-unlock-desc">{portalAlert.subtext}</span>
            </div>
          </div>
        )}

        {isWaiting && (
          <div className="lobby-overlay-waiting" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '24px', textAlign: 'center' }}>
            <div className="waiting-spinner-core" style={{ width: '48px', height: '48px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#00c8e9', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff', letterSpacing: '0.5px' }}>
              AWAITING CO-OP SIGNAL
            </h2>
            <p style={{ maxWidth: '420px', color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Both players share this maze. Player 1 steers Vertical (Up/Down) and Player 2 steers Horizontal (Left/Right).
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
      </div>

      <div className="telemetry-deck-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div className="side-card" style={{ marginTop: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
              COOPERATIVE CONTROLS — {playerId === 'P1' ? 'PLAYER 1 (VERTICAL)' : 'PLAYER 2 (HORIZONTAL)'}
            </h3>
            <span style={{ fontSize: '11px', color: '#ffc933', fontWeight: 700 }}>
              TRICKY KEYS: A/←: RIGHT · D/→: LEFT · S/↓: UP · W/↑: DOWN
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <button
              id="btn-maze-up"
              className="interactive-control-btn"
              onPointerDown={() => startMove('P1', 'Y', -1)}
              onPointerUp={() => stopMove('P1', 'Y')}
              onPointerLeave={() => stopMove('P1', 'Y')}
              onPointerCancel={() => stopMove('P1', 'Y')}
              style={{ height: '48px', fontSize: '12px', fontWeight: 700 }}
            >
              ▲ UP (S / ↓)
            </button>
            <button
              id="btn-maze-down"
              className="interactive-control-btn"
              onPointerDown={() => startMove('P1', 'Y', 1)}
              onPointerUp={() => stopMove('P1', 'Y')}
              onPointerLeave={() => stopMove('P1', 'Y')}
              onPointerCancel={() => stopMove('P1', 'Y')}
              style={{ height: '48px', fontSize: '12px', fontWeight: 700 }}
            >
              ▼ DOWN (W / ↑)
            </button>
            <button
              id="btn-maze-left"
              className="interactive-control-btn"
              onPointerDown={() => startMove('P2', 'X', -1)}
              onPointerUp={() => stopMove('P2', 'X')}
              onPointerLeave={() => stopMove('P2', 'X')}
              onPointerCancel={() => stopMove('P2', 'X')}
              style={{ height: '48px', fontSize: '12px', fontWeight: 700 }}
            >
              ◀ LEFT (D / →)
            </button>
            <button
              id="btn-maze-right"
              className="interactive-control-btn"
              onPointerDown={() => startMove('P2', 'X', 1)}
              onPointerUp={() => stopMove('P2', 'X')}
              onPointerLeave={() => stopMove('P2', 'X')}
              onPointerCancel={() => stopMove('P2', 'X')}
              style={{ height: '48px', fontSize: '12px', fontWeight: 700 }}
            >
              ▶ RIGHT (A / ←)
            </button>
          </div>
        </div>

        <div className="side-card" style={{ flex: 1, minHeight: '110px' }}>
          <h3 style={{ fontSize: '12px', marginBottom: '6px', fontWeight: 700, color: '#ffffff' }}>
            LIVE EXPEDITION TELEMETRY
          </h3>
          <div className="event-feed" style={{ maxHeight: '100px', overflowY: 'auto' }}>
            {gameState?.recentEvents && gameState.recentEvents.length > 0 ? (
              gameState.recentEvents.slice(0, 5).map((ev) => (
                <div key={ev.id} className={`feed-item feed-${ev.type}`} style={{ padding: '4px 0', fontSize: '11px', color: '#ffffff' }}>
                  <span>
                    <span className="feed-dot" style={{ background: '#00c8e9' }} />
                    {ev.message}
                  </span>
                  <time style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{ev.time}</time>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', padding: '14px 0' }}>
                Awaiting team inputs...
              </div>
            )}
          </div>
        </div>
      </div>

      {result && <ResultsModal result={result} onRestart={handleRestart} />}
    </div>
  );
}

export default function MazeApp({
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
  const [showGuidelines, setShowGuidelines] = useState(false);

  const socketClientRef = useRef(null);

  useEffect(() => {
    setCurrentSlot(playerSlot);
  }, [playerSlot]);

  useEffect(() => {
    const client = createMazeSocketClient({
      teamId,
      playerId: currentSlot,
      onTick: (state) => setGameState(state),
      onRoomStatus: (status) => setRoomStatus(status),
      onGameOver: (finalResult) => setResult(finalResult),
      onRejected: (data) => {
        setRejectedNotice(data.reason);
        setTimeout(() => setRejectedNotice(null), 2000);
      },
    });

    socketClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [teamId, currentSlot]);

  const sendInput = useCallback((targetRole, axis, dir) => {
    if (!socketClientRef.current) return;
    socketClientRef.current.sendInput(targetRole, axis, dir);
  }, []);

  useEffect(() => {
    const activeKeys = new Set();

    function updateMovement() {
      const triggerRight = activeKeys.has('a') || activeKeys.has('arrowleft');
      const triggerLeft = activeKeys.has('d') || activeKeys.has('arrowright');

      let vx = 0;
      if (triggerRight && !triggerLeft) {
        vx = 1;
      } else if (triggerLeft && !triggerRight) {
        vx = -1;
      }
      sendInput('P2', 'X', vx);

      const triggerUp = activeKeys.has('s') || activeKeys.has('arrowdown');
      const triggerDown = activeKeys.has('w') || activeKeys.has('arrowup');

      let vy = 0;
      if (triggerUp && !triggerDown) {
        vy = -1;
      } else if (triggerDown && !triggerUp) {
        vy = 1;
      }
      sendInput('P1', 'Y', vy);
    }

    function handleKeyDown(e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      const key = e.key.toLowerCase();
      if (!activeKeys.has(key)) {
        activeKeys.add(key);
        updateMovement();
      }
    }

    function handleKeyUp(e) {
      const key = e.key.toLowerCase();
      if (activeKeys.has(key)) {
        activeKeys.delete(key);
        updateMovement();
      }
    }

    function handleBlur() {
      activeKeys.clear();
      sendInput('P1', 'Y', 0);
      sendInput('P2', 'X', 0);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      sendInput('P1', 'Y', 0);
      sendInput('P2', 'X', 0);
    };
  }, [sendInput]);

  const handleRestart = () => {
    setResult(null);
    if (socketClientRef.current) {
      socketClientRef.current.sendAdminAction(`maze_${teamId}`, 'reset');
    }
  };

  const handleConnect = () => {
    if (socketClientRef.current) {
      socketClientRef.current.simulatePartnerConnect(`maze_${teamId}`, teamId, 'BOTH');
    }
  };

  const toggleSlot = () => {
    const nextSlot = currentSlot === 'P1' ? 'P2' : 'P1';
    setCurrentSlot(nextSlot);
    if (onSlotChange) onSlotChange(nextSlot);
  };

  return (
    <div className="maze-game-wrapper dual-viewport-wrapper">
      <ConstellationCanvas />

      <header className="dual-topbar-controls" style={{ padding: '12px 24px', background: '#0a1620', borderBottom: '1px solid rgba(0, 200, 233, 0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button className="product-btn product-btn--light" onClick={onBack} style={{ padding: '6px 14px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
              ← Dashboard
            </button>
          )}
          <div className="front-brand">
            <span className="front-tag" style={{ color: '#00c8e9', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>ROUND 01 / GAME 01</span>
            <h1 className="front-title" style={{ fontSize: '20px', margin: 0, color: '#ffffff', fontWeight: 800 }}>
              Dual-Control Maze
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
            <button
              onClick={toggleSlot}
              title="Click to switch your player slot"
              style={{
                background: currentSlot === 'P1' ? '#00c8e9' : '#d4f04a',
                color: '#000',
                border: 0,
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {currentSlot === 'P1' ? 'YOU: PLAYER 1 (VERTICAL)' : 'YOU: PLAYER 2 (HORIZONTAL)'} ⇄
            </button>
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
        <MazeMonitor
          playerId={currentSlot}
          teamId={teamId}
          gameState={gameState}
          roomStatus={roomStatus}
          result={result}
          rejectedNotice={rejectedNotice}
          sendInput={sendInput}
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
