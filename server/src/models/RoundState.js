import mongoose from "mongoose";
import { investigationCaseSchema } from "./InvestigationCase.js";

const roundStateSchema = new mongoose.Schema(
  {
    round: { type: Number, required: true, unique: true, min: 1 },
    attemptNo: { type: Number, min: 1, default: 1 },
    status: {
      type: String,
      enum: ["not_started", "running", "paused", "ended"],
      default: "not_started",
    },
    startedAt: { type: Date },
    deadline: { type: Date },
    durationSec: { type: Number, min: 1 },
    pausedAt: { type: Date },
    endedAt: { type: Date },
    revision: { type: Number, default: 0 },
    investigations: { type: [investigationCaseSchema], default: [] },
  },
  { timestamps: true },
);

export const RoundState = mongoose.model("RoundState", roundStateSchema);
