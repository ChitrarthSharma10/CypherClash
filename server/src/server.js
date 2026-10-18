import { createApp } from './app.js';
import { connectDatabase } from './db.js';
import { config } from './config.js';

await connectDatabase();
createApp().listen(config.port, () => {
  console.log(`CypherClash API listening on port ${config.port}`);
});
