import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDatabase() {
  await mongoose.connect(config.mongoUri);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
