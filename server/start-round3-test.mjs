import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "./src/models/Admin.js";
import { Team } from "./src/models/Team.js";
import { hashPassword } from "./src/utils/passwords.js";
import { advanceTeamProgression } from "./src/services/progression.js";
import { startRound } from "./src/services/roundState.js";

await mongoose.connect(process.env.MONGO_URI);

const username = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD;
let admin = await Admin.findOne({ username });

if (!admin) {
  admin = await Admin.create({
    username,
    passwordHash: await hashPassword(adminPassword)
  });
}

const teamId = "CC-001";
const team = await Team.findOne({ teamId });
if (!team) throw new Error(`Team ${teamId} not found`);

await advanceTeamProgression(teamId, {
  targetRound: 3,
  waivePriorRounds: true,
  reason: "Local Round 3 integration testing",
  adminId: admin._id
});

console.log("Team progression set to Round 3.");

try {
  const result = await startRound(3, 2700, admin._id.toString());
  console.log("Round 3 started:", result);
} catch (error) {
  console.log("Round 3 start response:", error.message);
  console.log("If it is already started, continue to the dashboard.");
}

await mongoose.disconnect();

