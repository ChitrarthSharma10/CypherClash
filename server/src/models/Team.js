import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    teamId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    biasPoints: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Team = mongoose.model('Team', teamSchema);
