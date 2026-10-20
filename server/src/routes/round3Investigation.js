import express from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Team } from "../models/Team.js";
import { requireTeam } from "../middleware/auth.js";
import {
  requireInvestigationParticipant,
  requireRunningInvestigation,
} from "../middleware/investigationAuth.js";
import { validateBody } from "../middleware/validation.js";
import {
  claimRound3Investigation,
  getRound3State,
  getRoundState,
  updateRound3Investigation,
} from "../services/roundState.js";
import { submitGameResult } from "../services/scoring.js";

const router = express.Router();
const emptySchema = z.object({}).strict();
const clueSchema = z.object({ key: z.enum(["ev1", "ev2", "ev3"]) }).strict();
const decryptSchema = z
  .object({ token: z.string().trim().min(1).max(32) })
  .strict();
const analystInviteSchema = z
  .object({ invite: z.string().trim().min(32).max(128) })
  .strict();
const accusationSchema = z
  .object({
    suspect: z.enum(["Mara Chen", "Idris Khan", "Sofia Laurent", "Evan Walsh"]),
    evidenceKey: z.enum(["ev1", "ev2", "ev3", "ev4"]),
    reasoning: z.string().trim().min(20).max(500),
  })
  .strict();
const hash = (token) => createHash("sha256").update(token).digest("hex");
const hashSession = (sessionId) => hash(sessionId);
const roleName = (role) =>
  role === "detective" ? "Lead Detective" : "Forensic Analyst";
const addActivityUpdate = (type, message, role, at = new Date()) => ({
  $each: [{ type, message, role, at }],
  $slice: -100,
});
function publicState(doc, role) {
  return {
    teamId: doc.teamId,
    round: doc.round,
    attemptNo: doc.attemptNo,
    roles: {
      detective: Boolean(doc.detectiveJoinedAt),
      analyst: Boolean(doc.analystJoinedAt),
    },
    role,
    clues: doc.clues.map((clue) => ({
      key: clue.key,
      addedBy: clue.addedBy,
      addedAt: clue.addedAt,
    })),
    decrypted: doc.decrypted,
    activity: doc.activity
      .slice(-50)
      .map((item) => ({
        type: item.type,
        message: item.message,
        role: item.role,
        at: item.at,
      })),
    accusation: doc.accusation
      ? {
          suspect: doc.accusation.suspect,
          evidenceKey: doc.accusation.evidenceKey,
          reasoning: doc.accusation.reasoning,
          submittedBy: doc.accusation.submittedBy,
          approvals: doc.accusation.approvals,
          submittedAt: doc.accusation.submittedAt,
          agreed:
            doc.accusation.approvals.includes("detective") &&
            doc.accusation.approvals.includes("analyst"),
        }
      : null,
  };
}
async function runningRound3() {
  const state = getRoundState(3);
  if (
    !state ||
    state.status !== "running" ||
    !state.deadline ||
    new Date(state.deadline).getTime() <= Date.now()
  )
    return null;
  return state;
}
function saveSession(req) {
  return new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );
}
function regenerateSession(req) {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
}

// The team account claims the detective station and creates a short-lived analyst invite.
router.post(
  "/join",
  requireTeam,
  validateBody(emptySchema),
  async (req, res, next) => {
    try {
      const round = await runningRound3();
      if (!round)
        return res
          .status(409)
          .json({ error: "Round 3 is not running", code: "ROUND_NOT_RUNNING" });
      const attemptNo = round.attemptNo ?? 1;
      const now = new Date();
      const invite = randomBytes(32).toString("base64url");
      const inviteExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
      const doc = await claimRound3Investigation(attemptNo, {
        teamId: req.team.teamId,
        round: 3,
        attemptNo,
        detectiveJoinedAt: now,
        detectiveSessionHash: hashSession(req.sessionID),
        inviteHash: hash(invite),
        inviteExpiresAt,
        clues: [],
        decrypted: false,
        decryptedAt: null,
        activity: [
          {
            type: "role_joined",
            message: "Lead Detective joined the case",
            role: "detective",
            at: now,
          },
        ],
        accusation: null,
      });
      if (!doc)
        return res
          .status(409)
          .json({
            error:
              "Round 3 is locked or the Lead Detective station is already claimed",
          });
      return res
        .status(201)
        .json({
          state: publicState(doc, "detective"),
          analystInvite: invite,
          inviteExpiresAt,
        });
    } catch (error) {
      return next(error);
    }
  },
);

// Analyst claims the invite on their own device; this does not invalidate the detective's team session.
router.post(
  "/join/analyst",
  validateBody(analystInviteSchema),
  async (req, res, next) => {
    try {
      const round = await getRound3State();
      if (
        !round ||
        round.status !== "running" ||
        !round.deadline ||
        new Date(round.deadline).getTime() <= Date.now()
      ) {
        return res
          .status(409)
          .json({ error: "Round 3 is not running", code: "ROUND_NOT_RUNNING" });
      }
      const tokenHash = hash(req.body.invite);
      const now = new Date();
      const attemptNo = round.attemptNo ?? 1;
      const invitation = round.investigations?.find(
        (entry) =>
          entry.inviteHash === tokenHash &&
          entry.attemptNo === attemptNo &&
          entry.analystJoinedAt == null &&
          entry.inviteExpiresAt > now &&
          !entry.finalResult,
      );
      if (
        !invitation?.inviteHash ||
        Buffer.from(tokenHash).length !==
          Buffer.from(invitation.inviteHash).length ||
        !timingSafeEqual(
          Buffer.from(tokenHash),
          Buffer.from(invitation.inviteHash),
        )
      ) {
        return res
          .status(401)
          .json({ error: "Invalid or expired analyst invitation" });
      }
      const team = await Team.findOne({ teamId: invitation.teamId }).select(
        "active",
      );
      if (!team?.active)
        return res.status(401).json({ error: "Team is inactive" });
      await regenerateSession(req);
      req.session.role = "investigation";
      req.session.teamId = invitation.teamId;
      req.session.investigationRole = "analyst";
      req.session.investigationAttemptNo = attemptNo;
      await saveSession(req);
      const doc = await updateRound3Investigation(
        attemptNo,
        {
          _id: invitation._id,
          teamId: invitation.teamId,
          attemptNo,
          inviteHash: tokenHash,
          inviteExpiresAt: { $gt: now },
          analystJoinedAt: null,
          finalResult: { $exists: false },
        },
        {
          $set: {
            "investigations.$.analystJoinedAt": now,
            "investigations.$.analystSessionHash": hashSession(req.sessionID),
          },
          $unset: {
            "investigations.$.inviteHash": 1,
            "investigations.$.inviteExpiresAt": 1,
          },
          $push: {
            "investigations.$.activity": {
              type: "role_joined",
              message: "Forensic Analyst joined the case",
              role: "analyst",
              at: now,
            },
          },
        },
      );
      if (!doc)
        return res
          .status(409)
          .json({ error: "The Forensic Analyst station is already claimed" });
      return res.status(201).json({ state: publicState(doc, "analyst") });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/invitation/renew",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(emptySchema),
  async (req, res, next) => {
    try {
      if (req.investigationRole !== "detective") {
        return res
          .status(403)
          .json({ error: "Only the Lead Detective can renew the invitation" });
      }
      const now = new Date();
      const invite = randomBytes(32).toString("base64url");
      const inviteExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        {
          teamId: req.team.teamId,
          attemptNo: req.investigation.attemptNo,
          detectiveSessionHash: hashSession(req.sessionID),
          analystJoinedAt: null,
          finalResult: { $exists: false },
        },
        {
          $set: {
            "investigations.$.inviteHash": hash(invite),
            "investigations.$.inviteExpiresAt": inviteExpiresAt,
          },
          $push: {
            "investigations.$.activity": {
              type: "invitation_renewed",
              message: "Lead Detective renewed the analyst invitation",
              role: "detective",
              at: now,
            },
          },
        },
      );
      if (!doc) {
        return res
          .status(409)
          .json({ error: "The analyst station is already claimed or the case is locked" });
      }
      return res.json({
        state: publicState(doc, "detective"),
        analystInvite: invite,
        inviteExpiresAt,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get("/state", requireInvestigationParticipant, async (req, res) =>
  res.json({
    state: publicState(req.investigation, req.investigationRole),
    roundStatus: req.investigationRound.status,
    serverNow: new Date(),
    deadline: req.investigationRound.deadline,
  }),
);

router.post(
  "/evidence",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(clueSchema),
  async (req, res, next) => {
    try {
      const key = req.body.key;
      if (key === "ev1" && req.investigationRole !== "detective")
        return res
          .status(403)
          .json({ error: "Only the Lead Detective can submit field evidence" });
      if (key === "ev4")
        return res
          .status(400)
          .json({
            error: "Forensic evidence is added by successful decryption",
          });
      const now = new Date();
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        {
          teamId: req.team.teamId,
          attemptNo: req.investigation.attemptNo,
          finalResult: { $exists: false },
          "clues.key": { $ne: key },
          accusation: null,
        },
        {
          $push: {
            "investigations.$.clues": {
              key,
              addedBy: req.investigationRole,
              addedAt: now,
            },
            "investigations.$.activity": addActivityUpdate(
              "evidence_added",
              `${key.toUpperCase()} added to the evidence ledger`,
              req.investigationRole,
              now,
            ),
          },
        },
      );
      if (!doc)
        return res
          .status(409)
          .json({
            error: "Evidence is already in the ledger or the case is locked",
          });
      return res
        .status(201)
        .json({ state: publicState(doc, req.investigationRole) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/decrypt",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(decryptSchema),
  async (req, res, next) => {
    try {
      if (req.investigationRole !== "analyst")
        return res
          .status(403)
          .json({ error: "Only the Forensic Analyst can decrypt the packet" });
      if (req.body.token.trim().toUpperCase() !== "HELIX") {
        await updateRound3Investigation(
          req.investigation.attemptNo,
          {
            teamId: req.team.teamId,
            attemptNo: req.investigation.attemptNo,
            finalResult: { $exists: false },
          },
          {
            $inc: { "investigations.$.wrongAttempts": 1 },
            $push: {
              "investigations.$.activity": addActivityUpdate(
                "decrypt_failed",
                "Decryption token rejected",
                "analyst",
              ),
            },
          },
        );
        return res.status(400).json({ error: "Token rejected" });
      }
      const now = new Date();
      let doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        {
          teamId: req.team.teamId,
          attemptNo: req.investigation.attemptNo,
          finalResult: { $exists: false },
          decrypted: false,
          "clues.key": { $ne: "ev4" },
          accusation: null,
        },
        {
          $set: {
            "investigations.$.decrypted": true,
            "investigations.$.decryptedAt": now,
          },
          $push: {
            "investigations.$.clues": {
              key: "ev4",
              addedBy: "analyst",
              addedAt: now,
            },
            "investigations.$.activity": addActivityUpdate(
              "decrypted",
              "Forensic Analyst decrypted the network token",
              "analyst",
              now,
            ),
          },
        },
      );
      if (!doc) {
        doc = await updateRound3Investigation(
          req.investigation.attemptNo,
          {
            teamId: req.team.teamId,
            attemptNo: req.investigation.attemptNo,
            finalResult: { $exists: false },
            decrypted: true,
            accusation: null,
          },
          { $inc: { revision: 0 } },
        );
      }
      if (!doc?.decrypted)
        return res.status(409).json({ error: "The case is locked" });
      return res.json({ state: publicState(doc, req.investigationRole) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/accusation",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(accusationSchema),
  async (req, res, next) => {
    try {
      const now = new Date();
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        {
          teamId: req.team.teamId,
          attemptNo: req.investigation.attemptNo,
          finalResult: { $exists: false },
          "clues.key": req.body.evidenceKey,
          accusation: null,
        },
        {
          $set: {
            "investigations.$.accusation": {
              ...req.body,
              submittedBy: req.investigationRole,
              approvals: [req.investigationRole],
              submittedAt: now,
            },
          },
          $push: {
            "investigations.$.activity": addActivityUpdate(
              "accusation_submitted",
              `${roleName(req.investigationRole)} submitted an accusation`,
              req.investigationRole,
              now,
            ),
          },
        },
      );
      if (!doc)
        return res
          .status(409)
          .json({
            error:
              "An accusation already exists or supporting evidence is not in the ledger",
          });
      return res
        .status(201)
        .json({ state: publicState(doc, req.investigationRole) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/accusation/approve",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(emptySchema),
  async (req, res, next) => {
    try {
      const now = new Date();
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        {
          teamId: req.team.teamId,
          attemptNo: req.investigation.attemptNo,
          finalResult: { $exists: false },
          accusation: { $ne: null },
          "accusation.submittedBy": { $ne: req.investigationRole },
          "accusation.approvals": { $ne: req.investigationRole },
        },
        {
          $addToSet: {
            "investigations.$.accusation.approvals": req.investigationRole,
          },
          $push: {
            "investigations.$.activity": addActivityUpdate(
              "accusation_approved",
              `${roleName(req.investigationRole)} approved the accusation`,
              req.investigationRole,
              now,
            ),
          },
        },
      );
      if (!doc)
        return res
          .status(409)
          .json({ error: "No accusation is awaiting approval for this role" });
      const currentCase =
        doc.investigations?.find(
          (entry) =>
            entry.teamId === req.team.teamId &&
            entry.attemptNo === req.investigation.attemptNo,
        ) || doc;
      const isAgreed =
        currentCase.accusation?.approvals?.includes("detective") &&
        currentCase.accusation?.approvals?.includes("analyst");
      if (isAgreed) {
        try {
          const wrongCount = currentCase.wrongAttempts || 0;
          const points = Math.max(150, 500 - 15 * wrongCount);
          await submitGameResult(req.team.teamId, "investigation", points);
        } catch (scoringError) {
          if (scoringError.code !== "RESULT_ALREADY_SUBMITTED") {
            console.warn("[Round 3] Scoring notice:", scoringError.message);
          }
        }
      }
      return res.json({ state: publicState(doc, req.investigationRole) });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
