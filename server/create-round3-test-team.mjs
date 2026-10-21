import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "./src/models/Admin.js";
import { Team } from "./src/models/Team.js";
import { hashPassword, generatePassword } from "./src/utils/passwords.js";
import { getOrCreateProgression } from "./src/services/progression.js";

await mongoose.connect(process.env.MONGO_URI);
const username = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword || adminPassword === "choose-a-unique-admin-password") {
  throw new Error("Set ADMIN_PASSWORD in server/.env to a value you choose, then rerun.");
}
let admin = await Admin.findOne({ username });
if (admin) {
  admin.passwordHash = await hashPassword(adminPassword);
  await admin.save();
} else {
  admin = await Admin.create({ username, passwordHash: await hashPassword(adminPassword) });
}
const latest = await Team.findOne().sort({ teamId: -1 }).select("teamId").lean();
const nextNumber = latest ? Number(latest.teamId.slice(3)) + 1 : 1;
const teamId = `CC-${String(nextNumber).padStart(3, "0")}`;
const password = generatePassword(12);
const team = await Team.create({
  teamId,
  name: "Round 3 Test Team",
  passwordHash: await hashPassword(password),
});
await getOrCreateProgression(teamId, 1, admin._id);
console.log("\nAdmin account ready:", username);
console.log("Test team created:", team.teamId);
console.log("Team password:", password);
await mongoose.disconnect();
