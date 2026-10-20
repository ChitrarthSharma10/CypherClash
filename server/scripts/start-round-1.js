import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
const RoundState = mongoose.model('RoundState', new mongoose.Schema({}, { strict: false }));
const now = new Date();
const deadline = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

await RoundState.updateOne(
  { round: 1 },
  {
    $set: {
      status: 'running',
      startedAt: now,
      deadline: deadline,
      durationSec: 14400,
    },
    $unset: { pausedAt: 1, endedAt: 1 },
  }
);

console.log('Successfully set Round 1 to running with active deadline.');
const r1 = await RoundState.findOne({ round: 1 });
console.log('Round 1:', r1.round, 'status:', r1.status, 'deadline:', r1.deadline);
await mongoose.disconnect();
process.exit(0);
