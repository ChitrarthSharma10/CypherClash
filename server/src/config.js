import "dotenv/config";

const required = [
  "MONGO_URI",
  "SESSION_SECRET",
  "FRONTEND_ORIGIN",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

if (
  process.env.SESSION_SECRET.length < 32 ||
  process.env.SESSION_SECRET.toLowerCase().includes("replace")
) {
  throw new Error(
    'SESSION_SECRET must be at least 32 characters and must not contain "replace"',
  );
}

if (
  process.env.ADMIN_PASSWORD.length < 12 ||
  process.env.ADMIN_PASSWORD.toLowerCase().includes("replace")
) {
  throw new Error(
    'ADMIN_PASSWORD must be at least 12 characters and must not contain "replace"',
  );
}

const trustProxy = Number(process.env.TRUST_PROXY || 0);
if (!Number.isInteger(trustProxy) || trustProxy < 0) {
  throw new Error("TRUST_PROXY must be a non-negative integer");
}

const bcryptCost = Number(process.env.BCRYPT_COST || 10);
if (!Number.isInteger(bcryptCost) || bcryptCost < 10) {
  throw new Error("BCRYPT_COST must be an integer of at least 10");
}

const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
if (!["lax", "strict", "none"].includes(sameSite)) {
  throw new Error("COOKIE_SAMESITE must be lax, strict, or none");
}

const originValues = process.env.FRONTEND_ORIGIN.split(",").map((origin) =>
  origin.trim(),
);
if (originValues.some((origin) => !origin)) {
  throw new Error("FRONTEND_ORIGIN must contain comma-separated exact origins");
}
const configuredOrigins = Array.from(
  new Set(
    originValues.map((origin) => {
      let parsed;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error("FRONTEND_ORIGIN entries must be valid exact origins");
      }
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.origin !== origin ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error("FRONTEND_ORIGIN entries must be valid exact origins");
      }
      return parsed.origin;
    }),
  ),
);
const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5177",
  "http://localhost:5157",
];
const frontendOrigins = Array.from(
  new Set([...configuredOrigins, ...defaultOrigins]),
);
const cookieSecure = process.env.COOKIE_SECURE === "true";
if (sameSite === "none" && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true when COOKIE_SAMESITE is "none"');
}

export const config = {
  mongoUri: process.env.MONGO_URI,
  sessionSecret: process.env.SESSION_SECRET,
  frontendOrigins,
  frontendOrigin: configuredOrigins[0] || "http://localhost:5173",
  port: Number(process.env.PORT || 4000),
  cookieSecure,
  cookieSameSite: sameSite,
  trustProxy,
  bcryptCost,
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
  seedSampleTeams: process.env.SEED_SAMPLE_TEAMS === "true",
  investigationLead3GithubUrl: (
    process.env.INVESTIGATION_LEAD3_GITHUB_URL ||
    "https://github.com/DDuggad/CyberHint"
  ).trim(),
};
