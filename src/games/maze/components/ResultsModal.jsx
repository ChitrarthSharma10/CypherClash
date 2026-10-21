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

        {result.breakdown && (
          <div
            style={{
              width: '100%',
              margin: '18px 0',
              padding: '16px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '13px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ecc71', fontWeight: 600 }}>
              <span>💎 Collectibles ({result.rawStats?.collectibles ?? 0})</span>
              <span>+{result.breakdown.collectiblesPoints ?? 0} pts</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ecc71', fontWeight: 600 }}>
              <span>🧭 Checkpoints ({result.rawStats?.checkpoints ?? 0})</span>
              <span>+{result.breakdown.checkpointsPoints ?? 0} pts</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ecc71', fontWeight: 600 }}>
              <span>⚡ Switches Activated</span>
              <span>+{result.breakdown.switchesPoints ?? 0} pts</span>
            </div>
            {result.breakdown.completionBonus > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00c8e9', fontWeight: 600 }}>
                <span>🏆 Vault Escape Bonus</span>
                <span>+{result.breakdown.completionBonus} pts</span>
              </div>
            )}
            {result.breakdown.timePoints > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00c8e9', fontWeight: 600 }}>
                <span>⏱️ Speed Bonus</span>
                <span>+{result.breakdown.timePoints} pts</span>
              </div>
            )}
            {(result.breakdown.hunterCatchPenalties > 0 || (result.rawStats?.hunterCatches ?? 0) > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff4d5e', fontWeight: 600 }}>
                <span>👾 Hunter Catch Penalty</span>
                <span>-{result.breakdown.hunterCatchPenalties} pts</span>
              </div>
            )}
            {(result.breakdown.pitFallPenalties > 0 || result.breakdown.hazardPenalties > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff4d5e', fontWeight: 600 }}>
                <span>⚠️ Hazard / Pit Penalty</span>
                <span>-{(result.breakdown.pitFallPenalties || 0) + (result.breakdown.hazardPenalties || 0)} pts</span>
              </div>
            )}
            <div
              style={{
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              <span>TOTAL (MAX 500)</span>
              <span style={{ color: '#00c8e9' }}>{score} PTS</span>
            </div>
          </div>
        )}

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
