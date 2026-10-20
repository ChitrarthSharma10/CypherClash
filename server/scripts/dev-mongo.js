import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../.mongo-data');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

console.log('Initializing local MongoDB server on port 27017...');
const mongod = await MongoMemoryServer.create({
  instance: {
    port: 27017,
    dbPath,
    storageEngine: 'wiredTiger',
  },
});

console.log('MongoDB is successfully running on:', mongod.getUri());

const keepAlive = () => {
  setTimeout(keepAlive, 10000);
};
keepAlive();

process.on('SIGINT', async () => {
  await mongod.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await mongod.stop();
  process.exit(0);
});
