import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import apiRouter from "./routes";
import { env } from "./config/env";
import { notFoundHandler } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";

export function createApp() {
  const app = express();
  const webRootDir = path.resolve(__dirname, "..");

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
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
