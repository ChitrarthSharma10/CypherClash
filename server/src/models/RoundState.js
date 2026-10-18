import mongoose from 'mongoose';

const roundStateSchema = new mongoose.Schema(
  {
    round: { type: Number, required: true, unique: true, min: 1 },
    status: {
      type: String,
      enum: ['not_started', 'running', 'paused', 'ended'],
      default: 'not_started',
    },
    startedAt: { type: Date },
    deadline: { type: Date },
    durationSec: { type: Number, min: 1 },
    pausedAt: { type: Date },
  },
  { timestamps: true },
);

export const RoundState = mongoose.model('RoundState', roundStateSchema);
