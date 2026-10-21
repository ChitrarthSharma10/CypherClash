import { createHash } from "node:crypto";
import { Team } from "../models/Team.js";
import { claimRound3Investigation, getRound3State, getRoundState } from "../services/roundState.js";

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
        (entry.detectiveSessionHash === currentSessionHash ||
          entry.analystSessionHash === currentSessionHash),
    );
    if (assignedAttempt && assignedAttempt.attemptNo !== attemptNo) {
      return res.status(403).json({
        error:
          "This session belongs to an earlier attempt. Rejoin the current case.",
      });
    }

    let investigation = round.investigations?.find(
      (entry) => entry.teamId === teamId && entry.attemptNo === attemptNo,
    );

    // Auto-initialize case for this team if not yet created and round exists
    if (!investigation && round) {
      const now = new Date();
      const currentSessionHash = sessionHash(req.sessionID);
      investigation = await claimRound3Investigation(attemptNo, {
        teamId,
        round: 3,
        attemptNo,
        detectiveJoinedAt: now,
        detectiveSessionHash: currentSessionHash,
        analystJoinedAt: now,
        analystSessionHash: currentSessionHash,
        clues: [],
        decrypted: false,
        decryptedAt: null,
        activity: [
          {
            type: "role_joined",
            message: "Joined the case workspace",
            role: "investigator",
            at: now,
          },
        ],
        accusation: null,
      });
    }

    if (!investigation) {
      return res
        .status(409)
        .json({ error: "Join the case before opening this page." });
    }

    if (
      req.session.role === "investigation" &&
      investigation.analystSessionHash &&
      investigation.analystSessionHash !== sessionHash(req.sessionID)
    ) {
      return res
        .status(403)
        .json({ error: "Session not authorized for this case." });
    }

    if (
      req.session.role === "investigation" &&
      !investigation.analystSessionHash
    ) {
      return res
        .status(403)
        .json({ error: "This invitation was not claimed." });
    }

    const requestedRole =
      req.headers["x-investigation-role"] ||
      req.headers["x-acting-role"] ||
      req.session.investigationRole ||
      (req.session.role === "team" ? "detective" : "investigator");
    req.team = team;
    req.investigation = investigation;
    req.investigationRole = requestedRole;
    req.investigationRound = round;
    req.investigationHasBothSeats = true;
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
