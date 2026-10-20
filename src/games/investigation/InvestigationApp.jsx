import { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import { createInvestigationSocketClient } from '../gameSocketClient.js';
import ConstellationCanvas from './components/ConstellationCanvas.jsx';
import SharedBoard from './components/SharedBoard.jsx';
import PlayerDossier from './components/PlayerDossier.jsx';
import ClueSubmissionModal from './components/ClueSubmissionModal.jsx';
import FinalVerdictModal from './components/FinalVerdictModal.jsx';
import ResultsModal from './components/ResultsModal.jsx';
import InvestigationGuidelinesModal from './components/InvestigationGuidelinesModal.jsx';

export default function InvestigationApp({
  teamId = 'CC-001',
  playerSlot = 'P1',
  onBack,
  onLogout,
  onSlotChange,
}) {
  const [currentSlot, setCurrentSlot] = useState(playerSlot);
  const [gameState, setGameState] = useState(null);
  const [roomStatus, setRoomStatus] = useState({
    p1Connected: false,
    p2Connected: false,
    status: 'WAITING_FOR_PLAYERS',
  });
  const [actionFeedback, setActionFeedback] = useState(null);
  const [hintData, setHintData] = useState(null);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showGuidelines, setShowGuidelines] = useState(false);

  const socketClientRef = useRef(null);
  const isP1 = currentSlot === 'P1';

  useEffect(() => {
    setCurrentSlot(playerSlot);
  }, [playerSlot]);

  useEffect(() => {
    const client = createInvestigationSocketClient({
      teamId,
      playerId: currentSlot,
      devMode: true,
      onTick: (state) => {
        setGameState(state);
        if (state.currentStage >= 5 && state.status === 'IN_PROGRESS') {
          setShowFinalModal(true);
        }
      },
      onRoomStatus: (status) => setRoomStatus(status),
      onActionFeedback: (fb) => {
        setActionFeedback(fb);
        setTimeout(() => setActionFeedback(null), 3500);
      },
      onHintResponse: (hData) => {
        if (hData.success) {
          setHintData(hData);
        }
      },
      onVerdictResponse: (vResp) => {
        if (vResp.success) {
          setShowFinalModal(false);
        }
      },
      onGameOver: (result) => {
        setFinalResult(result);
        setShowFinalModal(false);
      },
      onError: (err) => {
        setErrorMessage(err.message || 'Connection error');
      },
    });

    socketClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [teamId, currentSlot]);

  const handleConnectEvidence = (sourceCardId, targetCardId) => {
    if (socketClientRef.current) {
      socketClientRef.current.connectEvidence(sourceCardId, targetCardId);
    }
  };

  const handleSubmitClue = (stageId, answer) => {
    if (socketClientRef.current) {
      socketClientRef.current.submitClue(stageId, answer);
    }
  };

  const handleRequestHint = (stageId) => {
    if (socketClientRef.current) {
      socketClientRef.current.requestHint(stageId);
    }
  };

  const handleSubmitVerdict = (verdict, finalToken) => {
    if (socketClientRef.current) {
      socketClientRef.current.submitVerdict(verdict, finalToken);
    }
  };

  const handleSimulatePartner = () => {
    if (socketClientRef.current) {
      socketClientRef.current.simulatePartnerConnect('BOTH');
    }
  };

  const toggleSlot = () => {
    const nextSlot = currentSlot === 'P1' ? 'P2' : 'P1';
    setCurrentSlot(nextSlot);
    if (onSlotChange) onSlotChange(nextSlot);
  };

  const currentStage = gameState?.currentStage || 1;
  const isMyTurn = (currentStage === 1 && isP1) ||
                   (currentStage === 2 && !isP1) ||
                   (currentStage === 3 && isP1) ||
                   (currentStage === 4 && !isP1) ||
                   (currentStage >= 5);

  return (
    <div className="investigation-shell" style={{ background: '#050d14', color: '#e6f4f8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ConstellationCanvas />

      {/* Production Topbar Header */}
      <header className="dual-topbar-controls" style={{ padding: '12px 24px', background: '#0a1620', borderBottom: '1px solid rgba(0, 200, 233, 0.28)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button className="product-btn product-btn--light" onClick={onBack} style={{ padding: '6px 14px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
              ← Dashboard
            </button>
          )}
          <div className="front-brand">
            <span className="front-tag" style={{ color: '#00c8e9', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>ROUND 03 / COLLABORATIVE CASE</span>
            <h1 className="front-title" style={{ fontSize: '20px', margin: 0, color: '#ffffff', fontWeight: 800 }}>
              Cyber Incident Investigation
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
              title="Click to switch your analyst role"
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
              {currentSlot === 'P1' ? 'P1: COMMUNICATIONS ANALYST' : 'P2: SIEM / INFRA ANALYST'} ⇄
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
            📋 Briefing
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
            onClick={handleSimulatePartner}
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

      {/* Main Workspace */}
      <main className="investigation-content" style={{ flex: 1, padding: '20px 24px', display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '20px', zIndex: 2 }}>
        {/* Left Column: Shared Evidence Board & Case Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#0a1620', border: '1px solid rgba(0, 200, 233, 0.28)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#00c8e9', fontWeight: 700, letterSpacing: '0.8px' }}>STAGE {currentStage} / 5</span>
                <h2 style={{ fontSize: '18px', margin: '2px 0 0', fontWeight: 800 }}>Incident Evidence Board</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: isMyTurn ? '#d4f04a' : '#9fb8c2', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: isMyTurn ? 'rgba(212, 240, 74, 0.15)' : 'rgba(255,255,255,0.05)' }}>
                  {isMyTurn ? '● YOUR TURN TO ANALYZE' : '○ PARTNER ANALYZING'}
                </span>
                <div style={{ fontSize: '12px', color: '#e6f4f8', marginTop: '4px', fontWeight: 700 }}>
                  SCORE: <strong style={{ color: '#d4f04a' }}>{gameState?.score ?? 0} pts</strong>
                </div>
              </div>
            </div>

            <SharedBoard
              gameState={gameState}
              onConnectEvidence={handleConnectEvidence}
              playerId={currentSlot}
            />
          </div>

          <ClueSubmissionModal
            stageId={currentStage}
            isMyTurn={isMyTurn}
            gameState={gameState}
            hintData={hintData}
            onSubmitClue={handleSubmitClue}
            onRequestHint={handleRequestHint}
          />
        </div>

        {/* Right Column: Private Role Dossier */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <PlayerDossier
            playerId={currentSlot}
            privateDossier={gameState?.privateDossier}
            currentStage={currentStage}
          />
        </div>
      </main>

      {/* Notification Toast */}
      {actionFeedback && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: actionFeedback.success ? '#00c8e9' : '#ff4d5e',
          color: '#000',
          padding: '12px 20px',
          borderRadius: '6px',
          fontWeight: 800,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 100,
        }}>
          {actionFeedback.message}
        </div>
      )}

      {/* Guidelines Modal */}
      <InvestigationGuidelinesModal
        isOpen={showGuidelines}
        onClose={() => setShowGuidelines(false)}
      />

      {/* Final Case Verdict Modal */}
      {showFinalModal && (
        <FinalVerdictModal
          isOpen={showFinalModal}
          onClose={() => setShowFinalModal(false)}
          onSubmitVerdict={handleSubmitVerdict}
          gameState={gameState}
        />
      )}

      {/* Results Modal */}
      {finalResult && (
        <ResultsModal
          result={finalResult}
          onClose={() => setFinalResult(null)}
        />
      )}
    </div>
  );
}
