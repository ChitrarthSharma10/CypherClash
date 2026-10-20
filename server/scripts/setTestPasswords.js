import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { Team } from '../src/models/Team.js';
import { hashPassword } from '../src/utils/passwords.js';

await connectDatabase();
const hash = await hashPassword('TeamPass123!');
await Team.updateMany(
  { teamId: { $in: ['CC-001', 'CC-002', 'CC-003'] } },
  { $set: { passwordHash: hash, active: true } }
);
console.log('Test team passwords set to TeamPass123!');
await disconnectDatabase();
