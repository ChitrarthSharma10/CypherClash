const ONLINE_WINDOW_MS = 45_000;
const lastPresence = new Map();
const connectedTeams = new Set();

export function recordTeamPresence(teamId, at = Date.now()) {
  lastPresence.set(teamId, at);
}

export function setTeamConnected(teamId, connected) {
  if (connected) connectedTeams.add(teamId);
  else connectedTeams.delete(teamId);
}

export function isTeamOnline(teamId, now = Date.now()) {
  if (connectedTeams.has(teamId)) return true;
  const lastSeen = lastPresence.get(teamId);
  if (!lastSeen || now - lastSeen > ONLINE_WINDOW_MS) {
    lastPresence.delete(teamId);
    return false;
  }
  return true;
}
