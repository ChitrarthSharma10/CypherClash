import { Admin } from './models/Admin.js';
import { Team } from './models/Team.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { config } from './config.js';
import { generatePassword, hashPassword } from './utils/passwords.js';

await connectDatabase();

const adminPasswordHash = await hashPassword(config.adminPassword);
await Admin.findOneAndUpdate(
  { username: config.adminUsername },
  { username: config.adminUsername, passwordHash: adminPasswordHash },
  { upsert: true, new: true, setDefaultsOnInsert: true },
);
await Admin.deleteMany({ username: { $ne: config.adminUsername } });
console.log(`Admin seeded: ${config.adminUsername}`);

if (config.seedSampleTeams) {
  for (let index = 1; index <= 3; index += 1) {
    const teamId = `CC-${String(index).padStart(3, '0')}`;
    const existingTeam = await Team.findOne({ teamId });
    if (existingTeam) {
      console.log(`${teamId} already exists; skipping sample team.`);
      continue;
    }

    const password = generatePassword(12);
    await Team.create({
      teamId,
      name: `Sample Team ${index}`,
      passwordHash: await hashPassword(password),
    });
    console.log(`${teamId} seeded; use the admin reset-password action to issue its login password.`);
  }
}

await disconnectDatabase();
