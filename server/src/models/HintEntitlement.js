import mongoose from 'mongoose';

const hintEntitlementSchema = new mongoose.Schema(
  {
    teamId: { type: String, required: true },
    round: { type: Number, required: true, min: 1 },
    hintsUsed: { type: Number, required: true, default: 0, min: 0, max: 1 },
    hintDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

hintEntitlementSchema.index({ teamId: 1, round: 1 }, { unique: true });

export const HintEntitlement = mongoose.model('HintEntitlement', hintEntitlementSchema);
