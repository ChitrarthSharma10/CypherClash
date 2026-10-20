import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function ResultsModal({ result, onRestart, onBack }) {
  useEffect(() => {
    if (result && result.completed) {
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00c8e9', '#ffc933', '#7c4dff', '#ffffff'],
        });
      } catch (e) {
        // ignore
      }
    }
  }, [result]);

  if (!result) return null;

  const score = Math.max(0, Math.min(500, Math.round(result.score ?? result.standardResult?.score ?? 0)));

  const handleReturn = () => {
    if (typeof onBack === 'function') {
      onBack();
    } else {
      window.location.href = '/dashboard';
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 8, 14, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <section
        className="product-panel cc-circuit-finished"
        style={{
          maxWidth: '560px',
          width: '100%',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '24px',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 200, 233, 0.25)',
          padding: '48px 32px',
        }}
      >
        <p className="product-eyebrow">GAME COMPLETE</p>
        <h2>{result.completed ? 'Vault exit reached.' : 'Run completed.'}</h2>
        <strong>{score} POINTS</strong>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', lineHeight: 1.6, margin: '6px 0 20px' }}>
          Your score has been verified and recorded on the tournament leaderboard.
        </p>
        <button
          className="product-btn product-btn--light"
          onClick={handleReturn}
          style={{ width: '100%', padding: '14px 24px', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}
        >
          Return to dashboard
        </button>
      </section>
    </div>
  );
}
