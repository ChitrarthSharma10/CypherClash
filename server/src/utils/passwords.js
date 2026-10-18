import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { config } from '../config.js';

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptCost);
}

export function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function generatePassword(length = 12) {
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return result;
}
