import React, { useState } from 'react';

export default function ClueSubmissionModal({
  activeStage,
  onSubmitClue,
  onRequestHint,
  hintData,
  cooldownRemainingMs = 0,
  playerId = 'P1',
}) {
  const [answerInput, setAnswerInput] = useState('');

  if (!activeStage) return null;

  const {
    stageId,
    title,
    turn,
    isMyTurn,
    prompt,
    inputUnlocked,
    hintAvailable,
  } = activeStage;

  const inCooldown = cooldownRemainingMs > 0;
  const canSubmit = isMyTurn && inputUnlocked && !inCooldown;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answerInput.trim() || !canSubmit) return;
    if (onSubmitClue) {
      onSubmitClue(stageId, answerInput.trim());
      setAnswerInput('');
    }
  };

  return (
    <div className={`stage-submission-box ${isMyTurn ? 'my-turn' : ''} ${!inputUnlocked ? 'locked' : ''} ${inCooldown ? 'cooldown' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#00c8e9', textTransform: 'uppercase' }}>
            {title}
          </span>
          <span className="badge" style={{
            background: isMyTurn ? '#ffffff' : 'rgba(255,255,255,0.1)',
            color: isMyTurn ? '#000000' : 'rgba(255,255,255,0.8)',
            fontWeight: 800,
            fontSize: '11px',
          }}>
            {isMyTurn ? 'YOUR TURN TO SUBMIT' : `PARTNER'S TURN (PLAYER ${turn})`}
          </span>
        </div>

        {hintAvailable && isMyTurn && inputUnlocked && (
          <button
            type="button"
            className="hint-btn"
            onClick={() => onRequestHint && onRequestHint(stageId)}
          >
            Request Hint (-100 pts)
          </button>
        )}
      </div>

      <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', lineHeight: 1.45 }}>
        {prompt}
      </div>

      {hintData && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '6px',
          background: 'rgba(255, 201, 51, 0.12)',
          border: '1px solid rgba(255, 201, 51, 0.35)',
          fontSize: '12px',
          color: '#ffc933',
        }}>
          💡 <strong>Hint:</strong> {hintData.hint}
        </div>
      )}

      {!inputUnlocked ? (
        <div style={{
          padding: '12px',
          borderRadius: '6px',
          background: 'rgba(255, 201, 51, 0.08)',
          border: '1px dashed rgba(255, 201, 51, 0.4)',
          fontSize: '13px',
          color: '#ffc933',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          🔒 <span>Input locked. Identify and connect the required evidence cards on the shared board to unlock submission.</span>
        </div>
      ) : inCooldown ? (
        <div style={{
          padding: '12px',
          borderRadius: '6px',
          background: 'rgba(255, 77, 94, 0.12)',
          border: '1px solid rgba(255, 77, 94, 0.4)',
          fontSize: '13px',
          color: '#ff4d5e',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          ⏳ <span>Stage temporarily locked due to 3 wrong attempts. Cooldown expires in {Math.ceil(cooldownRemainingMs / 1000)} seconds.</span>
        </div>
      ) : isMyTurn ? (
        <form onSubmit={handleSubmit} className="input-group">
          <input
            type="text"
            className="clue-input"
            placeholder="Type verified clue answer (case-insensitive)..."
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            disabled={!canSubmit}
            autoFocus
          />
          <button type="submit" className="submit-btn" disabled={!canSubmit || !answerInput.trim()}>
            Verify & Unlock Next Clue
          </button>
        </form>
      ) : (
        <div style={{
          padding: '12px',
          borderRadius: '6px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.7)',
        }}>
          💬 <span>Player {turn} has the active submission box. Share your dossier evidence with them out-loud to help them answer!</span>
        </div>
      )}
    </div>
  );
}
