import { EventLog } from '../models/EventLog.js';

const MAX_LOG_STRING_LENGTH = 200;

function truncateLogValue(value, depth = 0) {
  if (typeof value === 'string') {
    return value.slice(0, MAX_LOG_STRING_LENGTH);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => truncateLogValue(item, depth + 1));
  }
  if (value && typeof value === 'object' && depth < 4) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [key.slice(0, MAX_LOG_STRING_LENGTH), truncateLogValue(item, depth + 1)]),
    );
  }
  return value;
}

export function logEvent({ type, actorType, actorId, teamId, details = {} }) {
  return EventLog.create({
    type: truncateLogValue(type),
    actorType: truncateLogValue(actorType),
    actorId: truncateLogValue(actorId),
    teamId: truncateLogValue(teamId),
    details: truncateLogValue(details),
  });
}
