import { Team } from '../models/Team.js';
import { getAllTotals } from './scoring.js';
import { listRoundStates, onRoundStateChange } from './roundState.js';

const ALLOWED_ROW_KEYS = ['rank', 'name', 'r1', 'r2', 'r3', 'total'];
let rows = [];
let updatedAt = null;
let indexByTeamId = new Map();
let rebuildTimer;
let rebuildPromise;
let generation = 0;
let lastRebuildAt = 0;
const MIN_REBUILD_INTERVAL_MS = 2000;

export function computeTotal(r1, r2, r3) {
  return [r1, r2, r3].reduce((total, points) => (
    points === null || points === undefined ? total : total + points
  ), 0);
}

export async function rebuildLeaderboard() {
  if (rebuildPromise) return rebuildPromise;
  const requestedGeneration = generation;
  rebuildPromise = (async () => {
    const [teams, totals] = await Promise.all([
      Team.find({ active: true }).select('teamId name').lean(),
      getAllTotals(),
    ]);
    const roundStates = new Map(listRoundStates().map((round) => [round.round, round]));
    const totalsByTeam = new Map(totals.map((item) => [item.teamId, item.rounds]));
    const sortableRows = teams.map((team) => {
      const teamRounds = totalsByTeam.get(team.teamId) || {};
      const roundPoints = [1, 2, 3].map((roundNumber) => {
        const state = roundStates.get(roundNumber);
        const started = state && state.status !== 'not_started';
        if (!started) return null;
        return teamRounds[roundNumber] ?? 0;
      });
      const [r1, r2, r3] = roundPoints;
      return {
        teamId: team.teamId,
        row: {
          rank: 0,
          name: team.name,
          r1,
          r2,
          r3,
          total: computeTotal(r1, r2, r3),
        },
      };
    });

    sortableRows.sort((first, second) => (
      second.row.total - first.row.total
      || first.row.name.localeCompare(second.row.name)
      || first.teamId.localeCompare(second.teamId)
    ));
    const nextIndexByTeamId = new Map();
    const nextRows = sortableRows.map(({ teamId, row }, index) => {
      row.rank = index > 0 && row.total === sortableRows[index - 1].row.total
        ? sortableRows[index - 1].row.rank
        : index + 1;
      nextIndexByTeamId.set(teamId, index);
      return row;
    });
    if (nextRows.some((row) => Object.keys(row).some((key) => !ALLOWED_ROW_KEYS.includes(key)))) {
      throw new Error('Leaderboard row contains an unexpected field');
    }
    rows = nextRows;
    indexByTeamId = nextIndexByTeamId;
    updatedAt = new Date().toISOString();
    lastRebuildAt = Date.now();
  })();
  try {
    await rebuildPromise;
  } finally {
    rebuildPromise = undefined;
  }
  if (generation !== requestedGeneration) scheduleRebuild();
  return { rows, updatedAt };
}

function scheduleRebuild() {
  if (rebuildTimer) return;
  const delay = Math.max(0, MIN_REBUILD_INTERVAL_MS - (Date.now() - lastRebuildAt));
  rebuildTimer = setTimeout(() => {
    rebuildTimer = undefined;
    rebuildLeaderboard().catch((error) => {
      console.error('Failed to rebuild leaderboard', error);
      scheduleRebuild();
    });
  }, delay);
  rebuildTimer.unref?.();
}

export function invalidateLeaderboard() {
  generation += 1;
  updatedAt = null;
  scheduleRebuild();
}

export async function getLeaderboard(teamId = null) {
  if (!updatedAt) {
    await rebuildLeaderboard();
  }
  return {
    rows,
    updatedAt,
    youIndex: teamId === null ? null : indexByTeamId.get(teamId) ?? null,
  };
}

onRoundStateChange(invalidateLeaderboard);
