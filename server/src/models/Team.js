import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    teamId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

teamSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Team = mongoose.model('Team', teamSchema);
