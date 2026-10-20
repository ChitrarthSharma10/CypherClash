import { createHash } from "node:crypto";
import { Team } from "../models/Team.js";
import { getRound3State, getRoundState } from "../services/roundState.js";

const sessionHash = (sessionId) =>
  createHash("sha256").update(sessionId).digest("hex");

export async function requireInvestigationParticipant(req, res, next) {
  try {
    const teamId = req.session?.teamId;
    if (!teamId || !["team", "investigation"].includes(req.session.role)) {
      return res
        .status(401)
        .json({ error: "Investigation authentication required" });
    }
    const team = await Team.findOne({ teamId }).select("teamId active");
    if (!team?.active)
      return res.status(401).json({ error: "Active team session required" });
    const round = await getRound3State();
    if (!round)
      return res
        .status(409)
        .json({ error: "Round 3 has not started", code: "ROUND_NOT_STARTED" });
    const attemptNo = round.attemptNo ?? 1;
    const currentSessionHash = sessionHash(req.sessionID);
    const assignedAttempt = round.investigations?.find(
      (entry) =>
        entry.teamId === teamId &&
        ((req.session.role === "team" &&
          entry.detectiveSessionHash === currentSessionHash) ||
          (req.session.role === "investigation" &&
            entry.analystSessionHash === currentSessionHash)),
    );
    if (assignedAttempt && assignedAttempt.attemptNo !== attemptNo) {
      return res
        .status(403)
        .json({ error: "Investigation assignment is stale" });
    }
    const investigation = round.investigations?.find(
      (entry) => entry.teamId === teamId && entry.attemptNo === attemptNo,
    );
    if (!investigation)
      return res.status(409).json({ error: "Join the investigation first" });
    const role =
      req.session.role === "team" &&
      investigation.detectiveSessionHash === currentSessionHash
        ? "detective"
        : req.session.role === "investigation" &&
            investigation.analystSessionHash === currentSessionHash
          ? "analyst"
          : null;
    if (!role)
      return res
        .status(403)
        .json({ error: "No investigation role assigned to this session" });
    req.team = team;
    req.investigation = investigation;
    req.investigationRole = role;
    req.investigationRound = round;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRunningInvestigation(req, res, next) {
  const round = getRoundState(3);
  if (
    !round ||
    round.status !== "running" ||
    !round.deadline ||
    new Date(round.deadline).getTime() <= Date.now()
  ) {
    return res
      .status(409)
      .json({ error: "Round 3 is locked", code: "ROUND_NOT_RUNNING" });
  }
  return next();
}
