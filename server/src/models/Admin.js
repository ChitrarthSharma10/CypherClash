import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export const Admin = mongoose.model('Admin', adminSchema);
