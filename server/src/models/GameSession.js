import mongoose from 'mongoose';
import { GAME_NAMES } from '../games/names.js';

const gameSessionSchema = new mongoose.Schema(
  {
    teamId: { type: String, required: true },
    round: { type: Number, required: true, min: 1 },
    attemptNo: { type: Number, required: true, min: 1 },
    game: { type: String, required: true, enum: GAME_NAMES },
    seed: { type: String, required: true, select: false },
    startedAt: { type: Date, required: true },
    deadline: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['active', 'submitted', 'expired', 'failed'],
      default: 'active',
    },
    failureReason: { type: String, maxlength: 200 },
    progress: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ stage: 1, wrongAttempts: 0, hintsUsed: 0 }),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

gameSessionSchema.index(
  { teamId: 1, round: 1, attemptNo: 1, game: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['active', 'submitted'] } },
  },
);

export const GameSession = mongoose.model('GameSession', gameSessionSchema);
