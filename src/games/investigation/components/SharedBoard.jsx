import React, { useState } from 'react';

export default function SharedBoard({
  cards = [],
  connections = [],
  onConnect,
  feedback,
  currentStage = 1,
  requiredHint,
  focusedIndex = 0,
}) {
  const [selectedCardId, setSelectedCardId] = useState(null);

  const handleCardClick = (cardId) => {
    if (!selectedCardId) {
      setSelectedCardId(cardId);
    } else if (selectedCardId === cardId) {
      setSelectedCardId(null);
    } else {
      if (onConnect) {
        onConnect(selectedCardId, cardId);
      }
      setSelectedCardId(null);
    }
  };

  const isConnected = (cardId) => {
    return connections.some((c) => c.from === cardId || c.to === cardId);
  };

  return (
    <div className="shared-board-container">
      {/* Board Header */}
      <div className="board-top-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 className="board-heading">Shared Investigation Board</h2>
          <span className="live-synced-indicator">
            <span className="synced-dot" />
            Live Synced
          </span>
        </div>
        <span className="board-instruction-text">
          {selectedCardId ? (
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Click 2nd card to complete link</span>
          ) : (
            'Click 2 cards to form evidence link'
          )}
        </span>
      </div>

      {/* Action / Rate Limit Feedback Toast */}
      {feedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '12.5px',
            fontWeight: 600,
            marginBottom: '14px',
            background: feedback.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: feedback.success ? '#22c55e' : '#f87171',
            border: `1px solid ${feedback.success ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Connection Objective Banner */}
      <div className="connection-objective-card">
        <strong style={{ color: '#ffffff' }}>Connection Objective: </strong>
        <span style={{ color: 'rgba(255, 255, 255, 0.82)' }}>
          {requiredHint || 'Connect the Suspicious Email card to the Incident Timestamp card on the shared board to unlock.'}
        </span>
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#ffc933', fontWeight: 700 }}>
          TRICKY KEYS: A/←: RIGHT · D/→: LEFT · S/↓: UP · W/↑: DOWN · SPACE/ENTER: SELECT
        </div>
      </div>

      {/* 2-Column Grid of Evidence Cards */}
      <div className="evidence-grid-2col">
        {cards.map((card, idx) => {
          const isSel = selectedCardId === card.id;
          const isConn = isConnected(card.id);
          const isFocused = focusedIndex === idx;

          return (
            <div
              key={card.id}
              className={`evidence-tile ${isSel ? 'selected' : ''} ${isConn ? 'linked' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
              style={isFocused ? { outline: '2px solid #ffc933', transform: 'scale(1.02)' } : undefined}
              onClick={() => handleCardClick(card.id)}
            >
              <div className="tile-top-row">
                <span className="tile-category-tag">
                  {card.badge ? card.badge.toUpperCase() : 'EVIDENCE'}
                </span>
                {isConn && (
                  <span className="tile-linked-badge">
                    ✓ linked
                  </span>
                )}
              </div>
              <h3 className="tile-title">{card.title}</h3>
              <p className="tile-description">{card.shortDesc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
