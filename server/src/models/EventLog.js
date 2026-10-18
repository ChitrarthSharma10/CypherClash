import mongoose from 'mongoose';

const eventLogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    actorType: { type: String, required: true },
    actorId: { type: String, required: true },
    teamId: { type: String, default: undefined },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

eventLogSchema.index({ createdAt: -1 });

export const EventLog = mongoose.model('EventLog', eventLogSchema);
