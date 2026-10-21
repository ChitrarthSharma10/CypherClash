import session from "express-session";
import { config } from "./config.js";
import { sessionStore } from "./sessionStore.js";

export const ADMIN_COOKIE_NAME = "cc_admin.sid";
export const TEAM_COOKIE_NAME = "cc_team.sid";
export const ANALYST_COOKIE_NAME = "cc_analyst.sid";

const cookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSameSite,
  maxAge: 12 * 60 * 60 * 1000,
  path: "/",
};

const baseSessionConfig = {
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
};

export const adminSessionMiddleware = session({
  ...baseSessionConfig,
  name: ADMIN_COOKIE_NAME,
  cookie: { ...cookieOptions },
});

export const teamSessionMiddleware = session({
  ...baseSessionConfig,
  name: TEAM_COOKIE_NAME,
  cookie: { ...cookieOptions },
});

export const analystSessionMiddleware = session({
  ...baseSessionConfig,
  name: ANALYST_COOKIE_NAME,
  cookie: { ...cookieOptions },
});

function hasCookie(req, name) {
  return (req.headers.cookie || "")
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${name}=`));
}

export function investigationSessionMiddleware(req, res, next) {
  const requestedRole = req.get("x-investigation-role") || req.get("x-acting-role");
  const hasAnalystCookie = hasCookie(req, ANALYST_COOKIE_NAME);
  const hasTeamCookie = hasCookie(req, TEAM_COOKIE_NAME);
  const useAnalystSession =
    req.path === "/join/analyst" ||
    (hasAnalystCookie && !hasTeamCookie) ||
    (requestedRole === "analyst" && !hasTeamCookie);

  return (useAnalystSession ? analystSessionMiddleware : teamSessionMiddleware)(
    req,
    res,
    next,
  );
}

// Backward-compatibility alias
export const sessionMiddleware = teamSessionMiddleware;

export function leaderboardSessionMiddleware(req, res, next) {
  const roleHeader = req.headers["x-session-role"];
  const roleQuery = req.query?.role;
  const cookieHeader = req.headers.cookie || "";
  const hasAdminCookie = cookieHeader.includes(ADMIN_COOKIE_NAME);
  const hasTeamCookie = cookieHeader.includes(TEAM_COOKIE_NAME);

  if (
    roleHeader === "admin" ||
    roleQuery === "admin" ||
    (hasAdminCookie && !hasTeamCookie)
  ) {
    return adminSessionMiddleware(req, res, next);
  }
  if (
    roleHeader === "team" ||
    roleQuery === "team" ||
    (hasTeamCookie && !hasAdminCookie)
  ) {
    return teamSessionMiddleware(req, res, next);
  }
  if (hasTeamCookie) {
    return teamSessionMiddleware(req, res, (err) => {
      if (err) return next(err);
      if (req.session?.role === "team") {
        return next();
      }
      if (hasAdminCookie) {
        return adminSessionMiddleware(req, res, next);
      }
      return next();
    });
  }
  if (hasAdminCookie) {
    return adminSessionMiddleware(req, res, next);
  }
  return teamSessionMiddleware(req, res, next);
}

export function authMeSessionMiddleware(req, res, next) {
  const roleHeader = req.headers["x-session-role"];
  const roleQuery = req.query?.role;
  const cookieHeader = req.headers.cookie || "";
  const hasAdminCookie = cookieHeader.includes(ADMIN_COOKIE_NAME);
  const hasTeamCookie = cookieHeader.includes(TEAM_COOKIE_NAME);

  if (
    roleHeader === "admin" ||
    roleQuery === "admin" ||
    (hasAdminCookie && !hasTeamCookie)
  ) {
    return adminSessionMiddleware(req, res, next);
  }
  if (
    roleHeader === "team" ||
    roleQuery === "team" ||
    (hasTeamCookie && !hasAdminCookie)
  ) {
    return teamSessionMiddleware(req, res, next);
  }
  if (hasTeamCookie) {
    return teamSessionMiddleware(req, res, (err) => {
      if (err) return next(err);
      if (req.session?.role === "team") {
        return next();
      }
      if (hasAdminCookie) {
        return adminSessionMiddleware(req, res, next);
      }
      return next();
    });
  }
  if (hasAdminCookie) {
    return adminSessionMiddleware(req, res, next);
  }
  return teamSessionMiddleware(req, res, next);
}

export function logoutSessionMiddleware(req, res, next) {
  const roleHeader = req.headers["x-session-role"];
  const roleQuery = req.query?.role;
  const roleBody = req.body?.role;
  const cookieHeader = req.headers.cookie || "";
  const hasAdminCookie = cookieHeader.includes(ADMIN_COOKIE_NAME);
  const hasTeamCookie = cookieHeader.includes(TEAM_COOKIE_NAME);

  const targetRole = roleBody || roleHeader || roleQuery;
  if (targetRole === "admin") {
    req.logoutTargetRole = "admin";
    return adminSessionMiddleware(req, res, next);
  }
  if (targetRole === "team") {
    req.logoutTargetRole = "team";
    return teamSessionMiddleware(req, res, next);
  }
  if (hasAdminCookie && !hasTeamCookie) {
    req.logoutTargetRole = "admin";
    return adminSessionMiddleware(req, res, next);
  }
  if (hasTeamCookie && !hasAdminCookie) {
    req.logoutTargetRole = "team";
    return teamSessionMiddleware(req, res, next);
  }
  const referer = req.headers.referer || "";
  if (referer.includes("/admin")) {
    req.logoutTargetRole = "admin";
    return adminSessionMiddleware(req, res, next);
  }
  req.logoutTargetRole = "team";
  return teamSessionMiddleware(req, res, next);
}
