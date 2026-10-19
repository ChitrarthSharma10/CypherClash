import express from "express";
import { z } from "zod";
import { EventLog } from "../models/EventLog.js";
import { Team } from "../models/Team.js";
import { RoundState } from "../models/RoundState.js";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { generatePassword, hashPassword } from "../utils/passwords.js";
import { logEvent } from "../utils/logging.js";
import { destroyTeamSessions } from "../sessionStore.js";
import { clearTeamLoginLockout, TEAM_ID_PATTERN } from "./auth.js";
import {
  endRound,
  listRoundStates,
  pauseRound,
  resumeRound,
  startRound,
} from "../services/roundState.js";
import { addAdjustment, getAllTotals } from "../services/scoring.js";
import { isTeamOnline } from "../services/presence.js";
import { invalidateLeaderboard } from "../services/leaderboard.js";

const router = express.Router();
router.use(requireAdmin);
router.param("teamId", (req, res, next, teamId) => {
  if (!TEAM_ID_PATTERN.test(teamId)) {
    return res.status(400).json({ error: "Invalid team ID" });
  }
  return next();
});
router.param("n", (req, res, next, value) => {
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    return res.status(400).json({ error: "Invalid round number" });
  }
  req.roundNumber = Number(value);
  return next();
});

const createTeamSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    biasPoints: z.number().finite().min(-1000).max(100000).default(0),
  })
  .strict();

const updateTeamSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    biasPoints: z.number().finite().min(-1000).max(100000).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

const emptyBodySchema = z.object({}).strict();
const startRoundSchema = z
  .object({
    durationSec: z.number().int().min(1).max(86400),
  })
  .strict();
const adjustmentSchema = z
  .object({
    round: z.number().int().min(1),
    amount: z.number().int().min(-1000).max(1000),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();

async function nextTeamId() {
  const latest = await Team.findOne()
    .sort({ teamId: -1 })
    .select("teamId")
    .lean();
  const nextNumber = latest ? Number(latest.teamId.slice(3)) + 1 : 1;
  return `CC-${String(nextNumber).padStart(3, "0")}`;
}

function serviceErrorStatus(error) {
  if (error.code === "TEAM_NOT_FOUND") return 404;
  if (
    [
      "RESULT_ALREADY_SUBMITTED",
      "ROUND_ALREADY_STARTED",
      "ROUND_NOT_RUNNING",
      "ROUND_NOT_PAUSED",
      "ROUND_NOT_ACTIVE",
      "ROUND_STATE_CHANGED",
    ].includes(error.code)
  )
    return 409;
  if (
    ["INVALID_ADJUSTMENT", "INVALID_GAME", "INVALID_POINTS"].includes(
      error.code,
    )
  ) {
    return 400;
  }
  return 500;
}

router.post(
  "/rounds/:n/start",
  validateBody(startRoundSchema),
  async (req, res, next) => {
    try {
      return res
        .status(201)
        .json(
          await startRound(
            req.roundNumber,
            req.body.durationSec,
            req.session.adminId,
          ),
        );
    } catch (error) {
      if (serviceErrorStatus(error) !== 500) {
        return res
          .status(serviceErrorStatus(error))
          .json({ error: error.message });
      }
      return next(error);
    }
  },
);

router.post(
  "/rounds/:n/pause",
  validateBody(emptyBodySchema),
  async (req, res, next) => {
    try {
      return res.json(await pauseRound(req.roundNumber, req.session.adminId));
    } catch (error) {
      if (serviceErrorStatus(error) !== 500) {
        return res
          .status(serviceErrorStatus(error))
          .json({ error: error.message });
      }
      return next(error);
    }
  },
);

router.post(
  "/rounds/:n/resume",
  validateBody(emptyBodySchema),
  async (req, res, next) => {
    try {
      return res.json(await resumeRound(req.roundNumber, req.session.adminId));
    } catch (error) {
      if (serviceErrorStatus(error) !== 500) {
        return res
          .status(serviceErrorStatus(error))
          .json({ error: error.message });
      }
      return next(error);
    }
  },
);

router.post(
  "/rounds/:n/end",
  validateBody(emptyBodySchema),
  async (req, res, next) => {
    try {
      return res.json(await endRound(req.roundNumber, req.session.adminId));
    } catch (error) {
      if (serviceErrorStatus(error) !== 500) {
        return res
          .status(serviceErrorStatus(error))
          .json({ error: error.message });
      }
      return next(error);
    }
  },
);

router.get("/rounds", (req, res) => res.json(listRoundStates()));

router.get("/investigation/final-results", async (req, res, next) => {
  try {
    const round = await RoundState.findOne({ round: 3 }).lean();
    const cases = (round?.investigations || [])
      .filter(({ finalResult }) => finalResult)
      .sort(
        (first, second) =>
          new Date(first.finalResult.roundEndedAt) -
            new Date(second.finalResult.roundEndedAt) ||
          first.teamId.localeCompare(second.teamId),
      );
    return res.json(
      cases.map(({ teamId, round: caseRound, attemptNo, finalResult }) => ({
        teamId,
        round: caseRound,
        attemptNo,
        ...finalResult,
      })),
    );
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/teams/:teamId/adjust",
  validateBody(adjustmentSchema),
  async (req, res, next) => {
    try {
      const before = await getAllTotals();
      const entry = await addAdjustment(
        req.params.teamId,
        req.body.round,
        req.body.amount,
        req.body.reason,
        req.session.adminId,
      );
      const after = await getAllTotals();
      await logEvent({
        type: "score adjustment",
        actorType: "admin",
        actorId: req.session.adminId,
        teamId: req.params.teamId,
        details: {
          old: before.find((item) => item.teamId === req.params.teamId) || {
            teamId: req.params.teamId,
            total: 0,
            rounds: {},
          },
          new: after.find((item) => item.teamId === req.params.teamId),
          entryId: entry._id.toString(),
        },
      });
      return res.status(201).json(entry);
    } catch (error) {
      if (serviceErrorStatus(error) !== 500) {
        return res
          .status(serviceErrorStatus(error))
          .json({ error: error.message });
      }
      return next(error);
    }
  },
);

router.get("/scores", async (req, res, next) => {
  try {
    return res.json(await getAllTotals());
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/teams",
  validateBody(createTeamSchema),
  async (req, res, next) => {
    let team;
    try {
      const teamId = await nextTeamId();
      const password = generatePassword(12);
      const passwordHash = await hashPassword(password);
      team = await Team.create({
        teamId,
        name: req.body.name,
        biasPoints: req.body.biasPoints,
        passwordHash,
      });
      await logEvent({
        type: "team created",
        actorType: "admin",
        actorId: req.session.adminId,
        teamId,
        details: { name: team.name },
      });
      invalidateLeaderboard();
      res.set("Cache-Control", "no-store");
      return res.status(201).json({
        team: {
          teamId: team.teamId,
          name: team.name,
          biasPoints: team.biasPoints,
          active: team.active,
        },
        password,
      });
    } catch (error) {
      try {
        if (team) {
          await Team.deleteOne({ _id: team._id });
        }
      } catch (rollbackError) {
        console.error("Failed to roll back team creation", rollbackError);
      }
      return next(error);
    }
  },
);

router.get("/teams", async (req, res, next) => {
  try {
    const teams = await Team.find().sort({ teamId: 1 }).lean();
    return res.json(
      teams.map((team) => ({ ...team, online: isTeamOnline(team.teamId) })),
    );
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/teams/:teamId",
  validateBody(updateTeamSchema),
  async (req, res, next) => {
    try {
      const previousTeam = await Team.findOne({
        teamId: req.params.teamId,
      }).lean();
      if (!previousTeam) {
        return res.status(404).json({ error: "Team not found" });
      }
      const team = await Team.findOneAndUpdate(
        { teamId: req.params.teamId },
        { $set: req.body },
        { new: true, runValidators: true },
      ).lean();
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      const teamChanged =
        (req.body.name !== undefined && req.body.name !== previousTeam.name) ||
        (req.body.biasPoints !== undefined &&
          req.body.biasPoints !== previousTeam.biasPoints) ||
        (req.body.active !== undefined &&
          req.body.active !== previousTeam.active);
      if (teamChanged) invalidateLeaderboard();
      if (req.body.active === false && previousTeam.active) {
        await destroyTeamSessions(team.teamId);
      }
      if (
        req.body.active !== undefined &&
        req.body.active !== previousTeam.active
      ) {
        await logEvent({
          type: req.body.active ? "team enabled" : "team disabled",
          actorType: "admin",
          actorId: req.session.adminId,
          teamId: team.teamId,
        });
      }
      if (req.body.name !== undefined && req.body.name !== previousTeam.name) {
        await logEvent({
          type: "team name edited",
          actorType: "admin",
          actorId: req.session.adminId,
          teamId: team.teamId,
          details: { oldName: previousTeam.name, newName: team.name },
        });
      }
      if (
        req.body.biasPoints !== undefined &&
        req.body.biasPoints !== previousTeam.biasPoints
      ) {
        await logEvent({
          type: "bias points changed",
          actorType: "admin",
          actorId: req.session.adminId,
          teamId: team.teamId,
          details: {
            oldValue: previousTeam.biasPoints,
            newValue: team.biasPoints,
          },
        });
      }
      return res.json({ team });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/teams/:teamId/reset-password",
  validateBody(emptyBodySchema),
  async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const password = generatePassword(12);
      const passwordHash = await hashPassword(password);
      const team = await Team.findOneAndUpdate(
        { teamId: req.params.teamId },
        { $set: { passwordHash } },
        { new: true, runValidators: true },
      )
        .select("teamId")
        .lean();
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      await destroyTeamSessions(team.teamId);
      await clearTeamLoginLockout(team.teamId);
      await logEvent({
        type: "password reset",
        actorType: "admin",
        actorId: req.session.adminId,
        teamId: req.params.teamId,
      });
      return res.json({ teamId: req.params.teamId, password });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/teams/:teamId/clear-login-lockout",
  validateBody(emptyBodySchema),
  async (req, res, next) => {
    try {
      const team = await Team.exists({ teamId: req.params.teamId });
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      await clearTeamLoginLockout(req.params.teamId);
      await destroyTeamSessions(req.params.teamId);
      await logEvent({
        type: "login lockout cleared",
        actorType: "admin",
        actorId: req.session.adminId,
        teamId: req.params.teamId,
      });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

router.get("/logs", async (req, res, next) => {
  try {
    const logs = await EventLog.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json(logs);
  } catch (error) {
    return next(error);
  }
});

export default router;
