import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function ResultsModal({ result, onRestart, onBack }) {
  useEffect(() => {
    if (result?.completed) {
      confetti({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#ff2a44', '#ffffff', '#ffd700'],
      });
    }
  }, [result]);

  if (!result) return null;

  const { completed, score, durationMs, rawStats, breakdown } = result;
  const durationSec = rawStats?.finishTimeSec ?? Math.round(durationMs / 1000);

  return (
    <div className="modal-backdrop">
      <div className="results-modal" style={{ background: '#0d1015', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
        <h2 style={{ color: '#ffffff', fontWeight: 700 }}>{completed ? 'FINISH LINE CROSSED' : 'RUN TERMINATED'}</h2>

        <div className="score-highlight" style={{ color: '#ffffff', fontWeight: 700 }}>
          {score} <span style={{ fontSize: '20px', color: '#ffffff' }}>PTS</span>
        </div>

        <div className="results-table" style={{ color: '#ffffff' }}>
          <div className="result-row">
            <span>Course Completed:</span>
            <strong>{rawStats?.distanceTraveled ?? 0}m / {rawStats?.courseLengthMeters ?? 4200}m</strong>
          </div>
          <div className="result-row">
            <span>Finish Time:</span>
            <strong style={{ color: '#ffffff' }}>{durationSec}s (~{(durationSec / 60).toFixed(1)} min)</strong>
          </div>
          <div className="result-row" style={{ color: '#ffffff' }}>
            <span>Time Score Bonus (25,000 / {durationSec}s):</span>
            <strong style={{ color: '#ffffff', fontWeight: 700 }}>+{breakdown?.timePoints ?? 0} PTS</strong>
          </div>
          <div className="result-row">
            <span>Gold Pickups:</span>
            <strong>+{breakdown?.coinPoints ?? 0} PTS</strong>
          </div>
          <div className="result-row">
            <span>Sector Gates ({rawStats?.checkpointsCleared ?? 0}/{rawStats?.totalCheckpoints ?? 8}):</span>
            <strong>+{breakdown?.checkpointPoints ?? 0} PTS</strong>
          </div>
          <div className="result-row" style={{ color: '#ffffff' }}>
            <span>Collisions ({rawStats?.collisions ?? 0}):</span>
            <strong style={{ color: '#ffffff', fontWeight: 700 }}>{breakdown?.collisionPenalties ?? 0} PTS</strong>
          </div>
        </div>

        <button
          className="play-game-big-btn"
          style={{ width: '100%', marginTop: '16px', background: '#00c8e9', color: '#000000', fontWeight: 800, border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer' }}
          onClick={onBack || onRestart}
        >
          {completed ? 'RETURN TO DASHBOARD (SCORE RECORDED)' : 'RETURN TO DASHBOARD'}
        </button>
      </div>
    </div>
  );
}
