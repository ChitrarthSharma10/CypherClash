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
import { isTeamEligibleForRound } from "../services/progression.js";
import { submitGameResult } from "../services/scoring.js";
import {
  CASE_EVIDENCE,
  CASE_HYPOTHESES,
  CASE_INTERVIEW_BY_KEY,
  CASE_PUZZLES,
  CASE_REPORT_REQUIRED_EVIDENCE,
  CASE_SUSPECTS,
  CASE_THEORIES,
  CANONICAL_EVENT_ORDER,
  getPublicCaseState,
  validatePuzzleAnswer,
} from "../games/caseHelix.js";

const router = express.Router();
const emptySchema = z.object({}).strict();
const clueSchema = z.object({ key: z.enum(["ev1", "ev2", "ev3"]) }).strict();
const decryptSchema = z
  .object({ token: z.string().trim().min(1).max(32) })
  .strict();
const analystInviteSchema = z
  .object({ invite: z.string().trim().min(32).max(128) })
  .strict();
const puzzleSubmissionSchema = z
  .object({ answer: z.record(z.string(), z.unknown()) })
  .strict();
const interviewSchema = z
  .object({
    suspectId: z.string().min(1).max(40),
    topicId: z.string().min(1).max(40),
    evidenceId: z.string().max(10).optional(),
  })
  .strict();
const hypothesisSchema = z
  .object({
    status: z.enum([
      "supported",
      "contradicted",
      "unresolved",
      "irrelevant",
      "unreliable",
    ]),
    evidenceIds: z.array(z.string().max(10)).min(2).max(8),
  })
  .strict();
const caseReportSchema = z
  .object({
    suspectId: z.string().min(1).max(40),
    method: z.string().min(1).max(60),
    motive: z.string().min(1).max(60),
    eventOrder: z.array(z.string().max(40)).length(6),
    evidenceIds: z.array(z.string().max(10)).min(8).max(28),
    auditExplanation: z.string().min(1).max(80),
    rejectedTheories: z.array(z.string().max(40)).optional(),
    alternativeReasoning: z.record(z.string().trim().min(40).max(1000)).optional(),
    reasoning: z.string().trim().min(80).max(2000),
  })
  .strict();
const hash = (token) => createHash("sha256").update(token).digest("hex");
const hashSession = (sessionId) => hash(sessionId);
const addActivityUpdate = (type, message, role, at = new Date()) => ({
  $each: [{ type, message, role, at }],
  $slice: -100,
});
function publicState(doc, role) {
  if (!doc) return null;
  const report = doc.gameState?.report;
  const approvals = report?.approvals ?? doc.accusation?.approvals ?? [];

  const isAgreed = Boolean(
    report != null ||
    (approvals.includes("detective") && approvals.includes("analyst")) ||
    doc.accusation?.agreed
  );

  const wrongAttempts = doc.wrongAttempts || 0;
  const score = isAgreed
    ? (report?.score ?? Math.max(150, 500 - 15 * wrongAttempts))
    : null;

  return {
    teamId: doc.teamId,
    round: doc.round,
    attemptNo: doc.attemptNo,
    roles: {
      detective: true,
      analyst: true,
    },
    role: role || "investigator",
    hasBothSeats: true,
    clues: (doc.clues || []).map((clue) => ({
      key: clue.key,
      addedBy: clue.addedBy,
      addedAt: clue.addedAt,
    })),
    decrypted: doc.decrypted,
    discoveredEvidence: doc.discoveredEvidence || [],
    solvedPuzzles: doc.solvedPuzzles || [],
    interviewFindings: doc.interviewFindings || [],
    resolvedHypotheses: doc.resolvedHypotheses || [],
    gameState: doc.gameState || {},
    reportAttempts: doc.reportAttempts || 0,
    wrongAttempts,
    score,
    completed: isAgreed,
    activity: (doc.activity || []).slice(-50).map((item) => ({
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
          agreed: isAgreed,
        }
      : null,
  };
}

function caseMutationFilter(req, extra = {}) {
  return {
    teamId: req.team.teamId,
    attemptNo: req.investigation.attemptNo,
    finalResult: { $exists: false },
    "gameState.report": { $exists: false },
    ...extra,
  };
}

function evaluateCaseReport(report, state) {
  const discovered = new Set(state.discoveredEvidence || []);
  if (report.evidenceIds.some((id) => !discovered.has(id))) {
    return {
      ok: false,
      error: "Your report includes records the team has not found yet.",
    };
  }
  if (report.evidenceIds.length !== new Set(report.evidenceIds).size) {
    return {
      ok: false,
      error: "Remove any record you selected more than once.",
    };
  }
  const requiredPuzzleIds = CASE_PUZZLES.filter(({ required }) => required).map(
    ({ id }) => id,
  );
  const hasOneInterview = (state.interviewFindings || []).length >= 1;
  if (
    !requiredPuzzleIds.every((id) =>
      (state.solvedPuzzles || []).includes(id),
    ) ||
    !hasOneInterview
  ) {
    return {
      ok: false,
      error:
        "Before sending the report, answer the clock and summary questions and ask one person a follow-up question.",
    };
  }

  const independentSources = new Set(
    report.evidenceIds
      .map((id) => CASE_EVIDENCE.find((entry) => entry.id === id)?.branch)
      .filter(Boolean),
  );
  const evidenceChain =
    CASE_REPORT_REQUIRED_EVIDENCE.every((id) =>
      report.evidenceIds.includes(id),
    ) && independentSources.size >= 4;

  const validTheories =
    !report.rejectedTheories ||
    (report.rejectedTheories.length === 2 &&
      (report.rejectedTheories.includes("database") ||
        report.rejectedTheories.includes("malfunction")) &&
      report.rejectedTheories.includes("contractor"));

  const correct =
    report.suspectId === "idris" &&
    report.method === "temporary-maintenance-exception" &&
    report.motive === "conceal-audit-exposure" &&
    report.auditExplanation === "later-summary-omitted-maintenance-context" &&
    report.eventOrder.every(
      (eventId, index) => eventId === CANONICAL_EVENT_ORDER[index],
    ) &&
    report.eventOrder.length === CANONICAL_EVENT_ORDER.length &&
    evidenceChain &&
    validTheories;

  return correct
    ? { ok: true }
    : {
        ok: false,
        error:
          "The records do not yet support every part of this report. Recheck the timeline, the access request, and the explanations you ruled out.",
      };
}
function runningRound3() {
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
        return res.status(409).json({
          error: "Round 3 is not open right now.",
          code: "ROUND_NOT_RUNNING",
        });
      if (!(await isTeamEligibleForRound(req.team.teamId, 3))) {
        return res.status(403).json({
          error:
            "Your team must complete the earlier rounds before joining Round 3.",
          code: "PROGRESSION_PREREQUISITE_NOT_MET",
        });
      }
      const attemptNo = round.attemptNo ?? 1;
      const now = new Date();
      const invite = randomBytes(32).toString("base64url");
      const inviteExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
      let doc = round.investigations?.find(
        (entry) =>
          entry.teamId === req.team.teamId && entry.attemptNo === attemptNo,
      );
      if (!doc) {
        doc = await claimRound3Investigation(attemptNo, {
          teamId: req.team.teamId,
          round: 3,
          attemptNo,
          detectiveJoinedAt: now,
          detectiveSessionHash: hashSession(req.sessionID),
          analystJoinedAt: null,
          analystSessionHash: null,
          inviteHash: hash(invite),
          inviteExpiresAt,
          clues: [],
          decrypted: false,
          decryptedAt: null,
          activity: [
            {
              type: "role_joined",
              message: "Joined the case investigation",
              role: "investigator",
              at: now,
            },
          ],
          accusation: null,
        });
      }
      if (!doc) {
        return res.status(409).json({
          error: "Round 3 is not open right now.",
          code: "ROUND_NOT_RUNNING",
        });
      }
      return res.status(201).json({
        state: publicState(doc, "detective"),
        detectiveState: publicState(doc, "detective"),
        analystState: publicState(doc, "analyst"),
        analystInvite: invite,
        inviteExpiresAt,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// Same-screen mode: authenticated team session holds both seats simultaneously.
router.post(
  "/join/same-screen",
  requireTeam,
  validateBody(emptySchema),
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
          .json({ error: "Round 3 is not open right now.", code: "ROUND_NOT_RUNNING" });
      }
      if (!(await isTeamEligibleForRound(req.team.teamId, 3))) {
        return res.status(403).json({
          error:
            "Your team must complete the earlier rounds before joining Round 3.",
          code: "PROGRESSION_PREREQUISITE_NOT_MET",
        });
      }
      const attemptNo = round.attemptNo ?? 1;
      const now = new Date();
      const currentSessionHash = hashSession(req.sessionID);

      const existing = round.investigations?.find(
        (entry) =>
          entry.teamId === req.team.teamId && entry.attemptNo === attemptNo,
      );

      let doc;
      if (!existing) {
        doc = await claimRound3Investigation(attemptNo, {
          teamId: req.team.teamId,
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
              message: "Lead Detective joined the case",
              role: "detective",
              at: now,
            },
            {
              type: "role_joined",
              message: "Forensic Analyst joined the case",
              role: "analyst",
              at: now,
            },
          ],
          accusation: null,
        });
      } else {
        doc = await updateRound3Investigation(
          attemptNo,
          {
            teamId: req.team.teamId,
            attemptNo,
            finalResult: { $exists: false },
          },
          {
            $set: {
              "investigations.$.detectiveSessionHash": currentSessionHash,
              "investigations.$.analystSessionHash": currentSessionHash,
              "investigations.$.detectiveJoinedAt": existing.detectiveJoinedAt || now,
              "investigations.$.analystJoinedAt": existing.analystJoinedAt || now,
            },
            $unset: {
              "investigations.$.inviteHash": 1,
              "investigations.$.inviteExpiresAt": 1,
            },
            $push: {
              "investigations.$.activity": {
                type: "role_joined",
                message: "Stations switched to same-screen mode",
                role: "system",
                at: now,
              },
            },
          },
        );
        if (!doc) {
          doc = existing;
        }
      }

      if (!doc) {
        return res
          .status(409)
          .json({ error: "Unable to claim stations for same-screen mode" });
      }

      req.session.investigationSeats = ["detective", "analyst"];
      await saveSession(req);

      return res.status(200).json({
        ok: true,
        detectiveState: publicState(doc, "detective"),
        analystState: publicState(doc, "analyst"),
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
        return res.status(409).json({
          error: "Round 3 is not open right now.",
          code: "ROUND_NOT_RUNNING",
        });
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
        return res.status(401).json({
          error:
            "That partner code is invalid or has expired. Ask the Detective for a new one.",
        });
      }
      const team = await Team.findOne({ teamId: invitation.teamId }).select(
        "active",
      );
      if (!team?.active)
        return res
          .status(401)
          .json({ error: "This team account is not active." });
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
              message: "Joined the case as Analyst",
              role: "analyst",
              at: now,
            },
          },
        },
      );
      if (!doc)
        return res
          .status(409)
          .json({ error: "Another player has already joined as Analyst." });
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
          .json({ error: "Only the Detective can create a new partner code." });
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
              message: "Created a new invitation for the Analyst",
              role: "detective",
              at: now,
            },
          },
        },
      );
      if (!doc) {
        return res.status(409).json({
          error: "The Analyst role is taken, or the case is no longer open.",
        });
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
    pausedAt: req.investigationRound.pausedAt,
    hasBothSeats: Boolean(req.investigationHasBothSeats),
  }),
);

router.get("/case", requireInvestigationParticipant, async (req, res) => {
  res.json({
    case: getPublicCaseState(req.investigation, req.investigationRole),
    state: publicState(req.investigation, req.investigationRole),
    serverNow: new Date(),
    deadline: req.investigationRound.deadline,
    pausedAt: req.investigationRound.pausedAt,
  });
});

router.post(
  "/case/evidence/:evidenceId",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(emptySchema),
  async (req, res, next) => {
    try {
      const evidence = CASE_EVIDENCE.find(
        ({ id }) => id === req.params.evidenceId,
      );
      if (!evidence)
        return res
          .status(404)
          .json({ error: "That record could not be found." });
      const discovered = new Set(req.investigation.discoveredEvidence || []);
      if (!evidence.requires.every((id) => discovered.has(id))) {
        return res.status(409).json({
          error: "Add the earlier records first to open this one.",
          requiredEvidence: evidence.requires,
        });
      }
      if (discovered.has(evidence.id)) {
        return res.json({
          case: getPublicCaseState(req.investigation, req.investigationRole),
          state: publicState(req.investigation, req.investigationRole),
        });
      }
      const resolvedHypotheses = CASE_HYPOTHESES.filter((hypothesis) =>
        hypothesis.resolvedBy.every(
          (id) => discovered.has(id) || id === evidence.id,
        ),
      ).map(({ id }) => id);
      const update = {
        $addToSet: {
          "investigations.$.discoveredEvidence": evidence.id,
        },
        $push: {
          "investigations.$.activity": addActivityUpdate(
            "evidence_discovered",
            `${evidence.id} added to the shared case file`,
            req.investigationRole,
          ),
        },
      };
      if (resolvedHypotheses.length) {
        update.$addToSet["investigations.$.resolvedHypotheses"] = {
          $each: resolvedHypotheses,
        };
      }
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        caseMutationFilter(req, { discoveredEvidence: { $ne: evidence.id } }),
        update,
      );
      if (!doc) {
        const current = await getRound3State();
        const updatedCase = current?.investigations?.find(
          (entry) =>
            entry.teamId === req.team.teamId &&
            entry.attemptNo === req.investigation.attemptNo,
        );
        if (updatedCase?.discoveredEvidence?.includes(evidence.id)) {
          return res.json({
            case: getPublicCaseState(updatedCase, req.investigationRole),
            state: publicState(updatedCase, req.investigationRole),
          });
        }
        return res.status(409).json({
          error: "The round has ended, so this case can no longer be changed.",
        });
      }
      console.info(
        "[Round 3]",
        JSON.stringify({
          event: "evidence_discovered",
          id: evidence.id,
          role: req.investigationRole,
        }),
      );
      return res.status(201).json({
        case: getPublicCaseState(doc, req.investigationRole),
        state: publicState(doc, req.investigationRole),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/case/puzzles/:puzzleId",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(puzzleSubmissionSchema),
  async (req, res, next) => {
    try {
      const puzzle = CASE_PUZZLES.find(({ id }) => id === req.params.puzzleId);
      if (!puzzle)
        return res
          .status(404)
          .json({ error: "That case question could not be found." });
      const discovered = new Set(req.investigation.discoveredEvidence || []);
      if (!puzzle.evidence.every((id) => discovered.has(id))) {
        return res.status(409).json({
          error:
            "Find the records listed for this question before answering it.",
        });
      }
      if ((req.investigation.solvedPuzzles || []).includes(puzzle.id)) {
        return res.json({
          solved: true,
          state: publicState(req.investigation, req.investigationRole),
        });
      }
      if (!validatePuzzleAnswer(puzzle.id, req.body.answer, discovered)) {
        await updateRound3Investigation(
          req.investigation.attemptNo,
          caseMutationFilter(req),
          {
            $inc: { "investigations.$.wrongAttempts": 1 },
            $push: {
              "investigations.$.activity": addActivityUpdate(
                "puzzle_attempted",
                `${puzzle.title} needs another look`,
                req.investigationRole,
              ),
            },
          },
        );
        return res.status(422).json({
          error:
            "That answer does not match the records yet. Check the details and try again.",
        });
      }
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        caseMutationFilter(req, { solvedPuzzles: { $ne: puzzle.id } }),
        {
          $addToSet: { "investigations.$.solvedPuzzles": puzzle.id },
          $push: {
            "investigations.$.activity": addActivityUpdate(
              "puzzle_solved",
              `${puzzle.title} answer confirmed`,
              req.investigationRole,
            ),
          },
        },
      );
      if (!doc)
        return res.status(409).json({
          error: "The round has ended, so this case can no longer be changed.",
        });
      console.info(
        "[Round 3]",
        JSON.stringify({
          event: "puzzle_solved",
          id: puzzle.id,
          role: req.investigationRole,
        }),
      );
      return res.json({
        solved: true,
        state: publicState(doc, req.investigationRole),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/case/interviews",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(interviewSchema),
  async (req, res, next) => {
    try {
      const key = `${req.body.suspectId}:${req.body.topicId}`;
      const entry = CASE_INTERVIEW_BY_KEY.get(key);
      if (!entry)
        return res
          .status(404)
          .json({ error: "That interview question could not be found." });
      const { suspect, topic } = entry;
      if (topic.evidence && req.body.evidenceId !== topic.evidence) {
        return res.status(409).json({
          error: "Bring the record named in this question before asking it.",
          requiredEvidence: topic.evidence,
        });
      }
      if (
        req.body.evidenceId &&
        !(req.investigation.discoveredEvidence || []).includes(
          req.body.evidenceId,
        )
      ) {
        return res.status(409).json({
          error: "Add that record to the team’s shared case file first.",
        });
      }
      const alreadyAsked = (req.investigation.interviewFindings || []).includes(
        key,
      );
      if (alreadyAsked) {
        const transcript = req.investigation.gameState?.transcripts?.[key];
        return res.json({
          answer: transcript || topic.response,
          state: publicState(req.investigation, req.investigationRole),
        });
      }
      const update = {
        $addToSet: {
          "investigations.$.interviewFindings": key,
        },
        $set: {
          [`investigations.$.gameState.transcripts.${key}`]: topic.response,
        },
        $push: {
          "investigations.$.activity": addActivityUpdate(
            "interview_opened",
            `Interview follow-up recorded for ${suspect.name}`,
            req.investigationRole,
          ),
        },
      };
      if (topic.unlock) {
        update.$addToSet["investigations.$.discoveredEvidence"] = topic.unlock;
      }
      const resolvedHypotheses = CASE_HYPOTHESES.filter((hypothesis) =>
        hypothesis.resolvedBy.every(
          (id) =>
            (req.investigation.discoveredEvidence || []).includes(id) ||
            id === topic.unlock,
        ),
      ).map(({ id }) => id);
      if (resolvedHypotheses.length) {
        update.$addToSet["investigations.$.resolvedHypotheses"] = {
          $each: resolvedHypotheses,
        };
      }
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        caseMutationFilter(req, { interviewFindings: { $ne: key } }),
        update,
      );
      if (!doc)
        return res.status(409).json({
          error: "The round has ended, so this case can no longer be changed.",
        });
      console.info(
        "[Round 3]",
        JSON.stringify({
          event: "interview_branch",
          suspect: suspect.id,
          topic: topic.id,
        }),
      );
      return res.json({
        answer: topic.response,
        unlockedEvidence: topic.unlock || null,
        state: publicState(doc, req.investigationRole),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/case/hypotheses/:hypothesisId",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(hypothesisSchema),
  async (req, res, next) => {
    try {
      const hypothesis = CASE_THEORIES.find(
        ({ id }) => id === req.params.hypothesisId,
      );
      if (!hypothesis)
        return res
          .status(404)
          .json({ error: "That explanation could not be found." });
      const discovered = new Set(req.investigation.discoveredEvidence || []);
      if (
        req.body.evidenceIds.some((id) => !discovered.has(id)) ||
        req.body.evidenceIds.length !== new Set(req.body.evidenceIds).size
      ) {
        return res.status(403).json({
          error: "Choose only records your team has already found.",
        });
      }
      const assessment = {
        status: req.body.status,
        evidenceIds: req.body.evidenceIds,
        updatedBy: req.investigationRole,
        updatedAt: new Date(),
      };
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        caseMutationFilter(req),
        {
          $set: {
            [`investigations.$.gameState.hypothesisAssessments.${hypothesis.id}`]:
              assessment,
          },
          $push: {
            "investigations.$.activity": addActivityUpdate(
              "hypothesis_assessed",
              `Reviewed the explanation: ${hypothesis.title}`,
              req.investigationRole,
            ),
          },
        },
      );
      if (!doc)
        return res.status(409).json({
          error: "The round has ended, so this case can no longer be changed.",
        });
      return res.json({ state: publicState(doc, req.investigationRole) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/case/report",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(caseReportSchema),
  async (req, res, next) => {
    try {
      const validation = evaluateCaseReport(req.body, req.investigation);
      if (!validation.ok) {
        await updateRound3Investigation(
          req.investigation.attemptNo,
          caseMutationFilter(req),
          {
            $inc: {
              "investigations.$.reportAttempts": 1,
              "investigations.$.wrongAttempts": 1,
            },
            $push: {
              "investigations.$.activity": addActivityUpdate(
                "report_review",
                "The final report needs stronger support from the records",
                req.investigationRole,
              ),
            },
          },
        );
        return res.status(422).json({ error: validation.error });
      }
      const now = new Date();
      const wrongAttempts = Number(req.investigation.wrongAttempts) || 0;
      const finalScore = Math.max(150, 500 - 15 * wrongAttempts);
      const isDualSeatDetective = req.investigationRole === "detective" && req.session.role === "team";
      const report = {
        ...req.body,
        submittedBy: req.investigationRole || "investigator",
        submittedAt: now,
        approvals: isDualSeatDetective ? ["detective"] : ["detective", "analyst"],
        score: finalScore,
      };
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        caseMutationFilter(req),
        {
          $set: { "investigations.$.gameState.report": report },
          $push: {
            "investigations.$.activity": addActivityUpdate(
              "case_report_submitted",
              "The final report was verified and submitted",
              req.investigationRole || "investigator",
              now,
            ),
          },
        },
      );
      if (!doc)
        return res.status(409).json({
          error: "A report is already completed or case is closed.",
        });
      if (!isDualSeatDetective) {
        try {
          await submitGameResult(req.team.teamId, "investigation", finalScore);
        } catch (scoringError) {
          if (scoringError.code !== "RESULT_ALREADY_SUBMITTED") throw scoringError;
        }
      }
      return res.status(201).json({
        state: publicState(doc, req.investigationRole),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/case/report/approve",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  validateBody(emptySchema),
  async (req, res, next) => {
    try {
      const now = new Date();
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        caseMutationFilter(req, {
          "gameState.report": { $ne: null },
          "gameState.report.submittedBy": { $ne: req.investigationRole },
          "gameState.report.approvals": { $ne: req.investigationRole },
        }),
        {
          $addToSet: {
            "investigations.$.gameState.report.approvals":
              req.investigationRole,
          },
          $push: {
            "investigations.$.activity": addActivityUpdate(
              "case_report_approved",
              "Partner approved the final report",
              req.investigationRole,
              now,
            ),
          },
        },
      );
      if (!doc) {
        return res.status(409).json({
          error: "There is no report waiting for your review.",
        });
      }
      const report = doc.gameState?.report;
      if (
        report?.approvals?.includes("detective") &&
        report?.approvals?.includes("analyst")
      ) {
        try {
          await submitGameResult(
            req.team.teamId,
            "investigation",
            report.score,
          );
        } catch (scoringError) {
          if (scoringError.code !== "RESULT_ALREADY_SUBMITTED")
            throw scoringError;
        }
      }
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
  (_req, res) =>
    res.status(410).json({
      error:
        "This old accusation form is no longer used. Submit the final case report instead.",
      next: "/api/investigation/case/report",
    }),
);

router.post(
  "/accusation/approve",
  requireInvestigationParticipant,
  requireRunningInvestigation,
  (_req, res) =>
    res.status(410).json({
      error:
        "This old accusation form is no longer used. Review the final case report instead.",
      next: "/api/investigation/case/report/approve",
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
      if (key === "ev4")
        return res.status(400).json({
          error: "Complete the computer-record question to add this record.",
        });
      const now = new Date();
      const doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        caseMutationFilter(req, {
          "clues.key": { $ne: key },
          accusation: null,
        }),
        {
          $push: {
            "investigations.$.clues": {
              key,
              addedBy: req.investigationRole,
              addedAt: now,
            },
            "investigations.$.activity": addActivityUpdate(
              "evidence_added",
              `${key.toUpperCase()} added to the team’s case file`,
              req.investigationRole,
              now,
            ),
          },
        },
      );
      if (!doc)
        return res.status(409).json({
          error:
            "This record is already in the case file, or the case is closed.",
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
      if (req.investigation.gameState?.report) {
        return res.status(409).json({
          error: "The final report has already been completed.",
        });
      }
      if (req.body.token.trim().toUpperCase() !== "HELIX") {
        await updateRound3Investigation(
          req.investigation.attemptNo,
          caseMutationFilter(req),
          {
            $inc: { "investigations.$.wrongAttempts": 1 },
            $push: {
              "investigations.$.activity": addActivityUpdate(
                "decrypt_failed",
                "The submitted answer was not correct",
                "analyst",
              ),
            },
          },
        );
        return res.status(400).json({
          error:
            "That answer is not correct yet. Check the records and try again.",
        });
      }
      const now = new Date();
      let doc = await updateRound3Investigation(
        req.investigation.attemptNo,
        caseMutationFilter(req, {
          decrypted: false,
          "clues.key": { $ne: "ev4" },
          accusation: null,
        }),
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
              "The Analyst completed the computer-record question",
              "analyst",
              now,
            ),
          },
        },
      );
      if (!doc) {
        doc = await updateRound3Investigation(
          req.investigation.attemptNo,
          caseMutationFilter(req, {
            decrypted: true,
            accusation: null,
          }),
          { $inc: { revision: 0 } },
        );
      }
      if (!doc?.decrypted)
        return res
          .status(409)
          .json({ error: "The case is closed and can no longer be changed." });
      return res.json({ state: publicState(doc, req.investigationRole) });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
