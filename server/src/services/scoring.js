import { ScoreEntry } from '../models/ScoreEntry.js';
import { Team } from '../models/Team.js';
import { invalidateLeaderboard } from './leaderboard.js';
import { getRunningRound } from './roundState.js';

export const GAME_NAMES = Object.freeze(['maze', 'runner', 'circuit']);

export class ScoringError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ScoringError';
    this.code = code;
  }
}

let allTotalsCache;

export function clearAllTotalsCache() {
  allTotalsCache = undefined;
  invalidateLeaderboard();
}

function formatTotals(rows, teamId) {
  const rounds = rows.reduce((result, row) => {
    result[row._id.round] = row.amount;
    return result;
  }, {});
  return {
    teamId,
    total: rows.reduce((total, row) => total + row.amount, 0),
    rounds,
  };
}

export async function getTotals(teamId) {
  const rows = await ScoreEntry.aggregate([
    { $match: { teamId } },
    { $group: { _id: { round: '$round' }, amount: { $sum: '$amount' } } },
    { $sort: { '_id.round': 1 } },
  ]);
  return formatTotals(rows, teamId);
}

export async function getAllTotals() {
  if (allTotalsCache && allTotalsCache.expiresAt > Date.now()) {
    return allTotalsCache.value;
  }
  const rows = await ScoreEntry.aggregate([
    { $group: { _id: { teamId: '$teamId', round: '$round' }, amount: { $sum: '$amount' } } },
    { $sort: { '_id.teamId': 1, '_id.round': 1 } },
  ]);
  const grouped = new Map();
  for (const row of rows) {
    const teamId = row._id.teamId;
    if (!grouped.has(teamId)) grouped.set(teamId, []);
    grouped.get(teamId).push({ _id: { round: row._id.round }, amount: row.amount });
  }
  const value = [...grouped.entries()].map(([teamId, teamRows]) => formatTotals(teamRows, teamId));
  allTotalsCache = { value, expiresAt: Date.now() + 5000 };
  return value;
}

export async function submitGameResult(teamId, game, points) {
  if (!GAME_NAMES.includes(game)) {
    throw new ScoringError('INVALID_GAME', 'Game is not supported');
  }
  const state = getRunningRound();
  if (!state || !state.deadline || state.deadline.getTime() <= Date.now()) {
    throw new ScoringError('ROUND_NOT_RUNNING', 'Round is not running');
  }
  if (!Number.isFinite(points)) {
    throw new ScoringError('INVALID_POINTS', 'Points must be a finite number');
  }
  const amount = Math.max(0, Math.min(1000, Math.trunc(points)));
  try {
    const entry = await ScoreEntry.create({
      teamId,
      round: state.round,
      attemptNo: state.attemptNo ?? 1,
      game,
      kind: 'game_result',
      amount,
      reason: 'game_result',
      actorType: 'system',
      actorId: 'system',
    });
    clearAllTotalsCache();
    return entry;
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.teamId && error?.keyPattern?.round && error?.keyPattern?.game) {
      throw new ScoringError('RESULT_ALREADY_SUBMITTED', 'Game result already submitted');
    }
    throw error;
  }
}

export async function addAdjustment(teamId, round, amount, reason, adminId) {
  const team = await Team.exists({ teamId });
  if (!team) throw new ScoringError('TEAM_NOT_FOUND', 'Team not found');
  if (!Number.isInteger(round) || round < 1) {
    throw new ScoringError('INVALID_ADJUSTMENT', 'Round must be a positive integer');
  }
  if (!Number.isInteger(amount) || amount < -1000 || amount > 1000) {
    throw new ScoringError('INVALID_ADJUSTMENT', 'Adjustment amount must be between -1000 and 1000');
  }
  if (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 200) {
    throw new ScoringError('INVALID_ADJUSTMENT', 'Adjustment reason is invalid');
  }
  const entry = await ScoreEntry.create({
    teamId,
    round,
    game: 'admin_adjustment',
    kind: 'adjustment',
    amount,
    reason,
    actorType: 'admin',
    actorId: adminId,
  });
  clearAllTotalsCache();
  return entry;
}
