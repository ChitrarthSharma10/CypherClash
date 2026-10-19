import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDatabase() {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  } catch (dnsErr) {
    // Ignore if not permitted
  }
  await mongoose.connect(config.mongoUri);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
