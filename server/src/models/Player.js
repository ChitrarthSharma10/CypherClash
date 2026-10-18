import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    teamId: { type: String, required: true, trim: true },
    slot: { type: String, enum: ['P1', 'P2'], required: true },
    passwordHash: { type: String, required: true, select: false },
    lastSeenAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: false },
);

playerSchema.index({ teamId: 1, slot: 1 }, { unique: true });

export const Player = mongoose.model('Player', playerSchema);
