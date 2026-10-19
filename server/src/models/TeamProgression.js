import mongoose from 'mongoose';

const overrideSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['advance', 'waive_round', 'initial_progression', 'revert_override'],
      required: true,
    },
    targetRound: { type: Number, min: 1, max: 4 },
    waivedRounds: [{ type: Number, min: 1, max: 4 }],
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    adminId: { type: String, required: true },
    previousMaxEligibleRound: { type: Number },
    previousWaivedRounds: [{ type: Number }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const teamProgressionSchema = new mongoose.Schema(
  {
    teamId: { type: String, required: true, unique: true, index: true },
    initialRound: { type: Number, default: 1, min: 1, max: 4 },
    maxEligibleRound: { type: Number, default: 1, min: 1, max: 4 },
    waivedRounds: [{ type: Number, min: 1, max: 4 }],
    overrides: [overrideSchema],
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export const TeamProgression = mongoose.model('TeamProgression', teamProgressionSchema);
