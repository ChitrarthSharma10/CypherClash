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
        // ignore if canvas-confetti is unavailable
      }
    }
  }, [result]);

  if (!result) return null;

  const { completed, score, penalties, breakdown, rawStats, durationMs } = result;
  const durationSec = Math.round(durationMs / 1000);

  return (
    <div className="modal-backdrop">
      <div className="results-modal" style={{ background: '#0d1015', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
        <div className="results-header">
          <h2 style={{ color: '#ffffff', fontWeight: 700 }}>
            {completed ? 'DUAL MAZE RUNNER CLEARED' : 'RUN TERMINATED'}
          </h2>
        </div>

        <div className="results-score-box">
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.1em' }}>
            TEAM SCORE
          </span>
          <div className="big-score" style={{ color: '#ffffff', fontWeight: 700 }}>{score}</div>
          <span style={{ fontSize: '12px', color: '#ffffff' }}>
            Finish Time: {durationSec}s · Hits: {penalties > 0 ? penalties : 0}
          </span>
        </div>

        {/* Score Breakdown Table */}
        <table className="breakdown-table" style={{ color: '#ffffff' }}>
          <tbody>
            {completed && (
              <>
                <tr>
                  <td>Time Score Bonus (25,000 / {durationSec}s)</td>
                  <td className="val positive" style={{ color: '#ffffff', fontWeight: 700 }}>+{breakdown?.timePoints || 0}</td>
                </tr>
                <tr>
                  <td>Escape Bonus</td>
                  <td className="val positive" style={{ color: '#ffffff', fontWeight: 700 }}>+{breakdown?.completionBonus || 0}</td>
                </tr>
              </>
            )}
            <tr>
              <td>Packets ({rawStats?.collectibles}/{rawStats?.totalCollectibles})</td>
              <td className="val positive" style={{ color: '#ffffff', fontWeight: 700 }}>+{breakdown?.collectiblesPoints || 0}</td>
            </tr>
            <tr>
              <td>Relays ({rawStats?.checkpoints}/{rawStats?.totalCheckpoints})</td>
              <td className="val positive" style={{ color: '#ffffff', fontWeight: 700 }}>+{breakdown?.checkpointsPoints || 0}</td>
            </tr>
            <tr>
              <td>Switches ({rawStats?.switchesActivated})</td>
              <td className="val positive" style={{ color: '#ffffff', fontWeight: 700 }}>+{breakdown?.switchesPoints || 0}</td>
            </tr>
            <tr>
              <td>Collisions ({rawStats?.collisions})</td>
              <td className="val negative" style={{ color: '#ffffff', fontWeight: 700 }}>{breakdown?.collisionDeductions || 0}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '14px' }}>
          <button
            className="front-btn-primary"
            style={{ width: '100%', background: '#00c8e9', color: '#000000', fontWeight: 800, border: 'none', padding: '12px 18px', borderRadius: '10px', cursor: 'pointer' }}
            onClick={onBack || onRestart}
          >
            {completed ? 'RETURN TO DASHBOARD (SCORE RECORDED)' : 'RETURN TO DASHBOARD'}
          </button>
        </div>
      </div>
    </div>
  );
}
