import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import apiRouter from "./routes";
import storeApplicationRoutes from "./routes/store-applications";
import { env } from "./config/env";
import { notFoundHandler } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";

function parseCorsOriginPatterns(rawValue: string) {
  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function wildcardMatch(value: string, pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

function normalizeUrlOrigin(input: string) {
  try {
    const parsed = new URL(input);
    return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, "").toLowerCase();
  } catch (_error) {
    return input.replace(/\/$/, "").toLowerCase();
  }
}

function isCorsOriginAllowed(origin: string, patterns: string[]) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeUrlOrigin(origin);
  let originHost = "";

  try {
    const parsed = new URL(origin);
    originHost = parsed.host.toLowerCase();
  } catch (_error) {
    originHost = "";
  }

  for (const pattern of patterns) {
    const normalizedPattern = pattern.replace(/\/$/, "").toLowerCase();
    if (normalizedPattern === "*") {
      return true;
    }

    if (normalizedPattern.includes("://")) {
      if (wildcardMatch(normalizedOrigin, normalizedPattern)) {
        return true;
      }
      continue;
    }

    if (originHost && wildcardMatch(originHost, normalizedPattern)) {
      return true;
    }
  }

  return false;
}

export function createApp() {
  const app = express();
  const webRootDir = __dirname.includes("dist")
    ? path.resolve(__dirname, "..", "..")
    : path.resolve(__dirname, "..");
  const corsOriginPatterns = parseCorsOriginPatterns(env.CORS_ORIGIN);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || isCorsOriginAllowed(origin, corsOriginPatterns)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc:     ["'self'"],
          scriptSrc:      ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc:        ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc:         ["'self'", "data:", "https:", "blob:"],
          connectSrc:     ["'self'"],
          workerSrc:      ["'self'", "blob:"],
          frameSrc:       ["'none'"],
          objectSrc:      ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use(env.API_PREFIX, apiRouter);
  app.use("/api/store-applications", storeApplicationRoutes);

  const sharedDir = path.resolve(webRootDir, "shared");
  app.use("/shared", express.static(sharedDir));

  const landingDir = path.resolve(webRootDir, "landing");
  app.use("/landing", express.static(landingDir));
  app.get("/", (_req, res) => {
    res.sendFile(path.resolve(landingDir, "index.html"));
  });

  const adminDir = path.resolve(webRootDir, "admin");
  app.use("/admin", express.static(adminDir));
  app.get("/admin", (_req, res) => {
    res.sendFile(path.resolve(adminDir, "index.html"));
  });

  const partnerDir = path.resolve(webRootDir, "partner");
  app.use("/partner", express.static(partnerDir));
  app.get("/partner", (_req, res) => {
    res.sendFile(path.resolve(partnerDir, "index.html"));
  });

  const customerDir = path.resolve(webRootDir, "customer");
  app.use("/customer", express.static(customerDir));
  app.get("/customer", (_req, res) => {
    res.sendFile(path.resolve(customerDir, "index.html"));
  });

  const driverDir = path.resolve(webRootDir, "driver");
  app.use("/driver", express.static(driverDir));
  app.get("/driver", (_req, res) => {
    res.sendFile(path.resolve(driverDir, "index.html"));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
