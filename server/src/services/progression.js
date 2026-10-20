import { TeamProgression } from '../models/TeamProgression.js';
import { ScoreEntry } from '../models/ScoreEntry.js';
import { GameSession } from '../models/GameSession.js';
import { logEvent } from '../utils/logging.js';
import { TOTAL_ROUNDS } from '../../../shared/rounds.js';

/**
 * Returns or initializes a TeamProgression document.
 */
export async function getOrCreateProgression(teamId, initialProgression = 1, adminId = 'system') {
  let doc = await TeamProgression.findOne({ teamId });
  if (!doc) {
    const initialRound = Math.max(1, Math.min(TOTAL_ROUNDS, Number(initialProgression) || 1));
    const waivedRounds = [];
    for (let r = 1; r < initialRound; r += 1) {
      waivedRounds.push(r);
    }
    const overrides = [];
    if (initialRound > 1) {
      overrides.push({
        action: 'initial_progression',
        targetRound: initialRound,
        waivedRounds,
        reason: `Initial progression set to Round ${initialRound} on team creation`,
        adminId,
        previousMaxEligibleRound: 1,
        previousWaivedRounds: [],
        createdAt: new Date(),
      });
    }
    try {
      doc = await TeamProgression.create({
        teamId,
        initialRound,
        maxEligibleRound: initialRound,
        waivedRounds,
        overrides,
      });
    } catch (err) {
      if (err?.code === 11000) {
        doc = await TeamProgression.findOne({ teamId });
      } else {
        throw err;
      }
    }
  }
  return doc;
}

/**
 * Returns the effective progression and per-round status for a team.
 */
export async function getEffectiveProgression(teamId) {
  const doc = await getOrCreateProgression(teamId);
  const waivedSet = new Set(doc.waivedRounds || []);

  const scoreEntries = await ScoreEntry.find({
    teamId,
    kind: 'game_result',
  }).select('round amount createdAt game').lean();

  const submittedSessions = await GameSession.find({
    teamId,
    status: 'submitted',
  }).select('round game startedAt deadline').lean();

  const scoreByRound = new Map();
  for (const entry of scoreEntries) {
    scoreByRound.set(entry.round, entry);
  }

  const sessionByRound = new Map();
  for (const s of submittedSessions) {
    sessionByRound.set(s.round, s);
  }

  const rounds = {};
  let naturalEligible = 1;

  for (let r = 1; r <= TOTAL_ROUNDS; r += 1) {
    const scoreEntry = scoreByRound.get(r);
    const session = sessionByRound.get(r);
    const hasCompleted = Boolean(scoreEntry || session);
    const isWaived = waivedSet.has(r);

    let status = 'pending';
    if (hasCompleted) {
      status = 'completed_normally';
    } else if (isWaived) {
      status = 'waived';
    }

    rounds[r] = {
      round: r,
      status,
      score: scoreEntry ? scoreEntry.amount : (isWaived ? 0 : null),
      game: scoreEntry?.game || session?.game || null,
      completedAt: scoreEntry?.createdAt || null,
      waived: isWaived,
    };

    // Sequential progression check: all prior rounds must be completed or waived
    if (r === naturalEligible && (hasCompleted || isWaived)) {
      naturalEligible = Math.min(TOTAL_ROUNDS, r + 1);
    }
  }

  const effectiveEligibleRound = Math.max(naturalEligible, doc.maxEligibleRound || 1);

  return {
    teamId,
    initialRound: doc.initialRound || 1,
    maxEligibleRound: doc.maxEligibleRound || 1,
    effectiveEligibleRound,
    waivedRounds: Array.from(waivedSet).sort((a, b) => a - b),
    rounds,
    overrides: (doc.overrides || []).map((o) => ({
      id: o._id,
      action: o.action,
      targetRound: o.targetRound,
      waivedRounds: o.waivedRounds || [],
      reason: o.reason,
      adminId: o.adminId,
      createdAt: o.createdAt,
    })),
  };
}

/**
 * Checks whether a team is eligible to participate in a given round.
 */
export async function isTeamEligibleForRound(teamId, roundNumber) {
  if (roundNumber <= 1) return true;
  const progression = await getEffectiveProgression(teamId);
  return progression.effectiveEligibleRound >= roundNumber;
}

/**
 * Action A: Advance team to a target round with optional waiver of prior rounds.
 */
export async function advanceTeamProgression(teamId, { targetRound, waivePriorRounds = true, reason, adminId }) {
  if (!Number.isInteger(targetRound) || targetRound < 1 || targetRound > TOTAL_ROUNDS) {
    const error = new Error(`Target round must be an integer between 1 and ${TOTAL_ROUNDS}`);
    error.code = 'INVALID_TARGET_ROUND';
    throw error;
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    const error = new Error('A valid reason (at least 3 characters) is required for progression advance');
    error.code = 'REASON_REQUIRED';
    throw error;
  }

  const doc = await getOrCreateProgression(teamId, 1, adminId);
  const previousMax = doc.maxEligibleRound;
  const previousWaived = [...(doc.waivedRounds || [])];

  const waivedSet = new Set(doc.waivedRounds || []);
  const newlyWaived = [];

  if (waivePriorRounds) {
    // Check which prior rounds are already completed
    const existingScores = await ScoreEntry.find({
      teamId,
      round: { $lt: targetRound },
      kind: 'game_result',
    }).select('round').lean();
    const completedRounds = new Set(existingScores.map((s) => s.round));

    for (let r = 1; r < targetRound; r += 1) {
      if (!completedRounds.has(r) && !waivedSet.has(r)) {
        waivedSet.add(r);
        newlyWaived.push(r);
      }
    }
  }

  doc.maxEligibleRound = Math.max(doc.maxEligibleRound || 1, targetRound);
  doc.waivedRounds = Array.from(waivedSet).sort((a, b) => a - b);

  doc.overrides.push({
    action: 'advance',
    targetRound,
    waivedRounds: newlyWaived,
    reason: reason.trim(),
    adminId,
    previousMaxEligibleRound: previousMax,
    previousWaivedRounds: previousWaived,
    createdAt: new Date(),
  });

  await doc.save();

  await logEvent({
    type: 'progression advance',
    actorType: 'admin',
    actorId: adminId,
    teamId,
    details: {
      targetRound,
      previousMaxEligibleRound: previousMax,
      newMaxEligibleRound: doc.maxEligibleRound,
      newlyWaivedRounds: newlyWaived,
      reason: reason.trim(),
    },
  }).catch(() => {});

  return getEffectiveProgression(teamId);
}

/**
 * Action B: Waive, unwaive, or mark completed normally for a specific round.
 */
export async function setRoundStatus(teamId, { roundNumber, status, reason, adminId }) {
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > TOTAL_ROUNDS) {
    const error = new Error(`Round must be an integer between 1 and ${TOTAL_ROUNDS}`);
    error.code = 'INVALID_ROUND';
    throw error;
  }
  if (!['waived', 'pending', 'completed_normally'].includes(status)) {
    const error = new Error('Status must be one of: waived, pending, completed_normally');
    error.code = 'INVALID_STATUS';
    throw error;
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    const error = new Error('A valid reason (at least 3 characters) is required');
    error.code = 'REASON_REQUIRED';
    throw error;
  }

  // If status is 'completed_normally', check evidence!
  if (status === 'completed_normally') {
    const hasScore = await ScoreEntry.exists({ teamId, round: roundNumber, kind: 'game_result' });
    const hasSession = await GameSession.exists({ teamId, round: roundNumber, status: 'submitted' });
    if (!hasScore && !hasSession) {
      const error = new Error(
        `Cannot mark Round ${roundNumber} as completed normally: no gameplay completion record exists in ScoreEntry or GameSession.`,
      );
      error.code = 'NO_COMPLETION_EVIDENCE';
      throw error;
    }
  }

  const doc = await getOrCreateProgression(teamId, 1, adminId);
  const previousMax = doc.maxEligibleRound;
  const previousWaived = [...(doc.waivedRounds || [])];
  const waivedSet = new Set(doc.waivedRounds || []);

  if (status === 'waived') {
    waivedSet.add(roundNumber);
  } else {
    waivedSet.delete(roundNumber);
  }

  doc.waivedRounds = Array.from(waivedSet).sort((a, b) => a - b);

  doc.overrides.push({
    action: 'waive_round',
    targetRound: roundNumber,
    waivedRounds: status === 'waived' ? [roundNumber] : [],
    reason: `${reason.trim()} [Set Round ${roundNumber} to ${status}]`,
    adminId,
    previousMaxEligibleRound: previousMax,
    previousWaivedRounds: previousWaived,
    createdAt: new Date(),
  });

  await doc.save();

  await logEvent({
    type: 'progression waive',
    actorType: 'admin',
    actorId: adminId,
    teamId,
    details: {
      round: roundNumber,
      status,
      reason: reason.trim(),
    },
  }).catch(() => {});

  return getEffectiveProgression(teamId);
}

/**
 * Action D: Revert an override safely.
 */
export async function revertProgressionOverride(teamId, { confirmDisruptive = false, reason, adminId }) {
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    const error = new Error('A valid reason (at least 3 characters) is required to revert progression overrides');
    error.code = 'REASON_REQUIRED';
    throw error;
  }

  const doc = await getOrCreateProgression(teamId, 1, adminId);

  // Check if team has active or submitted gameplay in rounds unlocked by override (round > 1)
  const laterSessions = await GameSession.find({
    teamId,
    round: { $gt: 1 },
    status: { $in: ['active', 'submitted'] },
  }).select('round status game').lean();

  const laterScores = await ScoreEntry.find({
    teamId,
    round: { $gt: 1 },
    kind: 'game_result',
  }).select('round amount game').lean();

  if ((laterSessions.length > 0 || laterScores.length > 0) && !confirmDisruptive) {
    return {
      warning: true,
      requiresConfirmation: true,
      message: `Team has ${laterSessions.length} session(s) and ${laterScores.length} score entry(ies) in later rounds. Reverting will restrict future round eligibility but will NOT delete legitimate gameplay history or earned scores. Please confirm to proceed.`,
      sessionsCount: laterSessions.length,
      scoresCount: laterScores.length,
    };
  }

  const previousMax = doc.maxEligibleRound;
  const previousWaived = [...(doc.waivedRounds || [])];

  doc.maxEligibleRound = 1;
  doc.waivedRounds = [];

  doc.overrides.push({
    action: 'revert_override',
    targetRound: 1,
    waivedRounds: [],
    reason: reason.trim(),
    adminId,
    previousMaxEligibleRound: previousMax,
    previousWaivedRounds: previousWaived,
    createdAt: new Date(),
  });

  await doc.save();

  await logEvent({
    type: 'progression revert',
    actorType: 'admin',
    actorId: adminId,
    teamId,
    details: {
      previousMaxEligibleRound: previousMax,
      previousWaivedRounds: previousWaived,
      reason: reason.trim(),
    },
  }).catch(() => {});

  return getEffectiveProgression(teamId);
}
