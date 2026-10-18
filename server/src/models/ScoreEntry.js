import mongoose from 'mongoose';

const scoreEntrySchema = new mongoose.Schema(
  {
    teamId: { type: String, required: true },
    round: { type: Number, required: true, min: 1 },
    game: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['game_result', 'adjustment'], required: true },
    amount: { type: Number, required: true, min: -1000, max: 1000, validate: Number.isInteger },
    reason: { type: String, required: true, maxlength: 200, trim: true },
    actorType: { type: String, enum: ['system', 'admin'], required: true },
    actorId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

scoreEntrySchema.index({ teamId: 1, round: 1 });
scoreEntrySchema.index(
  { teamId: 1, round: 1, game: 1 },
  { unique: true, partialFilterExpression: { kind: 'game_result' } },
);

export const ScoreEntry = mongoose.model('ScoreEntry', scoreEntrySchema);
