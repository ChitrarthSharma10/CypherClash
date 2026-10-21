import { createHash } from "node:crypto";
import { Team } from "../models/Team.js";
import { getRound3State, getRoundState } from "../services/roundState.js";

const sessionHash = (sessionId) =>
  createHash("sha256").update(sessionId).digest("hex");

export async function requireInvestigationParticipant(req, res, next) {
  try {
    const teamId = req.session?.teamId;
    if (!teamId || !["team", "investigation"].includes(req.session.role)) {
      return res.status(401).json({
        error: "Sign in with your team account before joining the case.",
      });
    }
    const team = await Team.findOne({ teamId }).select("teamId active");
    if (!team?.active)
      return res
        .status(401)
        .json({ error: "Your team session has expired. Sign in again." });
    const round = await getRound3State();
    if (!round)
      return res.status(409).json({
        error: "Round 3 has not started yet.",
        code: "ROUND_NOT_STARTED",
      });
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
      return res.status(403).json({
        error:
          "This session belongs to an earlier attempt. Rejoin the current case.",
      });
    }
    const investigation = round.investigations?.find(
      (entry) => entry.teamId === teamId && entry.attemptNo === attemptNo,
    );
    if (!investigation) {
      return res
        .status(409)
        .json({ error: "Join the case before opening this page." });
    }

    const hasDetectiveSeat =
      investigation.detectiveSessionHash === currentSessionHash;
    const hasAnalystSeat =
      investigation.analystSessionHash === currentSessionHash;

    const requestedRole =
      req.headers["x-acting-role"] || req.query.role || req.body?.actingRole;

    let role = null;

    if (hasDetectiveSeat && hasAnalystSeat) {
      if (requestedRole === "analyst" || requestedRole === "detective") {
        role = requestedRole;
      } else {
        role = req.session.role === "investigation" ? "analyst" : "detective";
      }
    } else if (hasDetectiveSeat && req.session.role === "team") {
      role = "detective";

      if (requestedRole && requestedRole !== "detective") {
        return res
          .status(403)
          .json({ error: "Session is not authorized for requested role" });
      }
    } else if (hasAnalystSeat && req.session.role === "investigation") {
      role = "analyst";

      if (requestedRole && requestedRole !== "analyst") {
        return res
          .status(403)
          .json({ error: "Session is not authorized for requested role" });
      }
    }

    if (!role)
      return res.status(403).json({
        error: "This session has not joined as Detective or Analyst.",
      });
    req.team = team;
    req.investigation = investigation;
    req.investigationRole = role;
    req.investigationRound = round;
    req.investigationHasBothSeats = hasDetectiveSeat && hasAnalystSeat;
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
    return res.status(409).json({
      error: "Round 3 is closed, so you cannot make changes.",
      code: "ROUND_NOT_RUNNING",
    });
  }
  return next();
}
