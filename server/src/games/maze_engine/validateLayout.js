import { GAME_CONFIG } from './config.js';

/**
 * Validates a maze layout:
 * - Start and exit cells are open grid cells
 * - Exit is reachable
 * - Progressive unlock BFS opens every barrier and reaches exit, all checkpoints, collectibles, and switches
 * - No item/trigger sits inside a wall, every barrier sits on an open cell
 * - A path to exit exists treating all hazard cells as blocked (player never forced to take hazard penalty)
 * - Shortest solution time is comfortably below round duration (< 60% of Round 1's 1800s defaultDurationSec)
 */

export function getShortestPath(grid, width, height, startCol, startRow, targetCol, targetRow, blockedSet = new Set()) {
  if (startCol === targetCol && startRow === targetRow) return [ [startCol, startRow] ];
  const q = [[startCol, startRow]];
  const visited = new Set([`${startCol},${startRow}`]);
  const parent = new Map();

  while (q.length > 0) {
    const [cx, cy] = q.shift();
    if (cx === targetCol && cy === targetRow) {
      // Reconstruct path
      const path = [];
      let curr = `${targetCol},${targetRow}`;
      while (curr) {
        const [x, y] = curr.split(',').map(Number);
        path.unshift([x, y]);
        curr = parent.get(curr);
      }
      return path;
    }

    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (grid[ny][nx] === 1) continue;
      const key = `${nx},${ny}`;
      if (blockedSet.has(key) || visited.has(key)) continue;

      visited.add(key);
      parent.set(key, `${cx},${cy}`);
      q.push([nx, ny]);
    }
  }

  return null;
}

export function calculateLayoutSolution(layout, treatHazardsAsBlocked = false) {
  const width = layout.width;
  const height = layout.height;
  const grid = layout.grid;

  const startCol = Math.floor(layout.start.x);
  const startRow = Math.floor(layout.start.y);
  const exitCol = Math.floor(layout.exit.x);
  const exitRow = Math.floor(layout.exit.y);

  const hazardBlocked = new Set();
  if (treatHazardsAsBlocked && layout.hazards) {
    for (const h of layout.hazards) {
      hazardBlocked.add(`${Math.floor(h.x)},${Math.floor(h.y)}`);
    }
  }

  // Active closed barriers
  const openBarriers = new Set();
  const activatedSwitches = new Set();

  let currCol = startCol;
  let currRow = startRow;
  let totalLength = 0;

  // Progressive unlock: repeatedly find the nearest unactivated switch reachable from current position
  // with current closed barriers blocking passage.
  const remainingSwitches = [...layout.switches];

  while (remainingSwitches.length > 0) {
    // Current blocked cells = closed barriers + hazardBlocked
    const blocked = new Set(hazardBlocked);
    for (const b of layout.barriers) {
      if (!openBarriers.has(b.id)) {
        blocked.add(`${b.x},${b.y}`);
      }
    }

    // Find nearest reachable unactivated switch
    let nearestSwitch = null;
    let shortestPathToSwitch = null;

    for (let i = 0; i < remainingSwitches.length; i++) {
      const sw = remainingSwitches[i];
      const targetCol = Math.floor(sw.x);
      const targetRow = Math.floor(sw.y);

      const path = getShortestPath(grid, width, height, currCol, currRow, targetCol, targetRow, blocked);
      if (path && (!shortestPathToSwitch || path.length < shortestPathToSwitch.length)) {
        nearestSwitch = sw;
        shortestPathToSwitch = path;
      }
    }

    if (!nearestSwitch) {
      throw new Error(`Progressive unlock stalled: cannot reach remaining ${remainingSwitches.length} switches in ${layout.id}`);
    }

    // Move to this switch
    totalLength += (shortestPathToSwitch.length - 1);
    currCol = Math.floor(nearestSwitch.x);
    currRow = Math.floor(nearestSwitch.y);
    activatedSwitches.add(nearestSwitch.id);

    // Open target barrier
    const targetBarrier = layout.barriers.find((b) => b.id === nearestSwitch.targetBarrierId);
    if (targetBarrier) {
      openBarriers.add(targetBarrier.id);
    }

    // Remove from remaining
    const idx = remainingSwitches.indexOf(nearestSwitch);
    remainingSwitches.splice(idx, 1);
  }

  // Now all switches activated and barriers open. Path to exit!
  const finalBlocked = new Set(hazardBlocked);
  for (const b of layout.barriers) {
    if (!openBarriers.has(b.id)) {
      finalBlocked.add(`${b.x},${b.y}`);
    }
  }

  const pathToExit = getShortestPath(grid, width, height, currCol, currRow, exitCol, exitRow, finalBlocked);
  if (!pathToExit) {
    throw new Error(`Cannot reach exit after opening all barriers in ${layout.id}`);
  }

  totalLength += (pathToExit.length - 1);

  return {
    totalLength,
    estimatedSeconds: totalLength / (GAME_CONFIG.SPEED || 2.2),
  };
}

export function validateLayout(layout) {
  if (!layout) throw new Error('Layout is required');
  const { id, name, width, height, grid, start, exit, collectibles = [], checkpoints = [], switches = [], barriers = [], hazards = [] } = layout;

  if (!width || !height || !grid || grid.length !== height) {
    throw new Error(`Invalid layout grid dimensions for ${id}`);
  }

  const startCol = Math.floor(start.x);
  const startRow = Math.floor(start.y);
  const exitCol = Math.floor(exit.x);
  const exitRow = Math.floor(exit.y);

  // 1. Start and exit cells are open
  if (grid[startRow]?.[startCol] === 1) {
    throw new Error(`Start position (${startCol}, ${startRow}) is inside a wall in layout ${id}`);
  }
  if (grid[exitRow]?.[exitCol] === 1) {
    throw new Error(`Exit position (${exitCol}, ${exitRow}) is inside a wall in layout ${id}`);
  }

  // 2. Barriers sit on open grid cells
  for (const b of barriers) {
    if (grid[b.y]?.[b.x] === 1) {
      throw new Error(`Barrier ${b.id} is placed on a wall cell (${b.x}, ${b.y}) in ${id}`);
    }
  }

  // 3. No collectibles, checkpoints, switches, or hazards on wall cells
  for (const c of collectibles) {
    const col = Math.floor(c.x);
    const row = Math.floor(c.y);
    if (grid[row]?.[col] === 1) {
      throw new Error(`Collectible ${c.id} is placed on a wall cell (${col}, ${row}) in ${id}`);
    }
  }
  for (const cp of checkpoints) {
    const col = Math.floor(cp.x);
    const row = Math.floor(cp.y);
    if (grid[row]?.[col] === 1) {
      throw new Error(`Checkpoint ${cp.id} is placed on a wall cell (${col}, ${row}) in ${id}`);
    }
  }
  for (const sw of switches) {
    const col = Math.floor(sw.x);
    const row = Math.floor(sw.y);
    if (grid[row]?.[col] === 1) {
      throw new Error(`Switch ${sw.id} is placed on a wall cell (${col}, ${row}) in ${id}`);
    }
    if (!barriers.some((b) => b.id === sw.targetBarrierId)) {
      throw new Error(`Switch ${sw.id} targets non-existent barrier ${sw.targetBarrierId} in ${id}`);
    }
  }
  for (const h of hazards) {
    const col = Math.floor(h.x);
    const row = Math.floor(h.y);
    if (grid[row]?.[col] === 1) {
      throw new Error(`Hazard ${h.id} is placed on a wall cell (${col}, ${row}) in ${id}`);
    }
  }

  // 4. Progressive unlock BFS
  const solution = calculateLayoutSolution(layout, false);

  // Check reachability of all items with all barriers open
  const openBarriersSet = new Set(barriers.map((b) => b.id));
  const emptyBlocked = new Set();

  for (const c of collectibles) {
    const col = Math.floor(c.x);
    const row = Math.floor(c.y);
    const path = getShortestPath(grid, width, height, startCol, startRow, col, row, emptyBlocked);
    if (!path) {
      throw new Error(`Collectible ${c.id} at (${col}, ${row}) is unreachable in layout ${id}`);
    }
  }

  for (const cp of checkpoints) {
    const col = Math.floor(cp.x);
    const row = Math.floor(cp.y);
    const path = getShortestPath(grid, width, height, startCol, startRow, col, row, emptyBlocked);
    if (!path) {
      throw new Error(`Checkpoint ${cp.id} at (${col}, ${row}) is unreachable in layout ${id}`);
    }
  }

  // 5. A path to the exit exists with ALL hazard cells treated as blocked
  const hazardSolution = calculateLayoutSolution(layout, true);
  if (!hazardSolution || hazardSolution.totalLength === Infinity) {
    throw new Error(`Layout ${id} has no path to exit when all hazards are blocked!`);
  }

  // 6. Shortest solution length * (1 / player speed) comfortably below round time
  // Default Round 1 duration is 1800s. Solution must be < 60% of 1800s = 1080s.
  const round1DurationSec = 1800;
  const maxAllowedSec = round1DurationSec * 0.6; // 1080s
  if (solution.estimatedSeconds > maxAllowedSec) {
    throw new Error(`Layout ${id} solution takes estimated ${solution.estimatedSeconds}s, exceeding 60% of round duration (${maxAllowedSec}s)`);
  }

  return {
    valid: true,
    id,
    name,
    solutionLength: solution.totalLength,
    estimatedSeconds: Math.round(solution.estimatedSeconds * 10) / 10,
    hazardFreeSolutionLength: hazardSolution.totalLength,
    hazardFreeEstimatedSeconds: Math.round(hazardSolution.estimatedSeconds * 10) / 10,
  };
}
