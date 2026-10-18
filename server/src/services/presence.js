const ONLINE_WINDOW_MS = 45_000;
const lastPresence = new Map();
const connectedPlayers = new Set();

function playerKey(teamId, slot) {
  return `${teamId}:${slot}`;
}

export function recordPlayerPresence(teamId, slot, at = Date.now()) {
  lastPresence.set(playerKey(teamId, slot), at);
}

export function setPlayerConnected(teamId, slot, connected) {
  const key = playerKey(teamId, slot);
  if (connected) connectedPlayers.add(key);
  else connectedPlayers.delete(key);
}

export function isPlayerOnline(teamId, slot, now = Date.now()) {
  const key = playerKey(teamId, slot);
  if (connectedPlayers.has(key)) return true;
  const lastSeen = lastPresence.get(key);
  if (!lastSeen || now - lastSeen > ONLINE_WINDOW_MS) {
    lastPresence.delete(key);
    return false;
  }
  return true;
}
