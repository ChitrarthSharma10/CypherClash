import mongoose from "mongoose";

const clueSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, enum: ["ev1", "ev2", "ev3", "ev4"] },
    addedBy: { type: String, required: true, enum: ["detective", "analyst"] },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);
const activitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, maxlength: 40 },
    message: { type: String, required: true, maxlength: 180 },
    role: {
      type: String,
      required: true,
      enum: ["detective", "analyst", "system"],
    },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);
const accusationSchema = new mongoose.Schema(
  {
    suspect: {
      type: String,
      enum: ["Mara Chen", "Idris Khan", "Sofia Laurent", "Evan Walsh"],
      required: true,
    },
    evidenceKey: {
      type: String,
      enum: ["ev1", "ev2", "ev3", "ev4"],
      required: true,
    },
    reasoning: { type: String, required: true, minlength: 20, maxlength: 500 },
    submittedBy: {
      type: String,
      required: true,
      enum: ["detective", "analyst"],
    },
    approvals: { type: [String], enum: ["detective", "analyst"], default: [] },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);
const finalAccusationSchema = new mongoose.Schema(
  {
    submitted: { type: Boolean, required: true },
    suspect: {
      type: String,
      enum: ["Mara Chen", "Idris Khan", "Sofia Laurent", "Evan Walsh"],
      default: null,
    },
    evidenceKey: {
      type: String,
      enum: ["ev1", "ev2", "ev3", "ev4"],
      default: null,
    },
    reasoning: { type: String, default: null },
    initiatedBy: {
      type: String,
      enum: ["detective", "analyst"],
      default: null,
    },
    initiatedAt: { type: Date, default: null },
    approvals: {
      detective: { type: Boolean, required: true },
      analyst: { type: Boolean, required: true },
    },
    agreed: { type: Boolean, required: true },
  },
  { _id: false },
);
const finalResultSchema = new mongoose.Schema(
  {
    evidence: { type: [clueSchema], required: true },
    decryption: {
      succeeded: { type: Boolean, required: true },
      succeededAt: { type: Date, default: null },
    },
    accusation: { type: finalAccusationSchema, default: null },
    roundEndedAt: { type: Date, required: true },
  },
  { _id: false },
);

export const investigationCaseSchema = new mongoose.Schema(
  {
    teamId: { type: String, required: true },
    round: { type: Number, required: true, default: 3 },
    attemptNo: { type: Number, required: true, default: 1 },
    detectiveJoinedAt: { type: Date, default: null },
    analystJoinedAt: { type: Date, default: null },
    detectiveSessionHash: { type: String, default: null },
    analystSessionHash: { type: String, default: null },
    inviteHash: { type: String, default: null, select: false },
    inviteExpiresAt: { type: Date, default: null },
    clues: { type: [clueSchema], default: [] },
    decrypted: { type: Boolean, default: false },
    decryptedAt: { type: Date, default: null },
    activity: { type: [activitySchema], default: [] },
    accusation: { type: accusationSchema, default: null },
    finalResult: { type: finalResultSchema, default: undefined },
  },
  { timestamps: true },
);
export const InvestigationCase = mongoose.model(
  "InvestigationCase",
  investigationCaseSchema,
);
