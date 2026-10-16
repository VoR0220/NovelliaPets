import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { config } from "./config";
import { errorHandler } from "./middleware/error";
import authRoutes from "./routes/auth";
import petsRoutes from "./routes/pets";
import dashboardRoutes from "./routes/dashboard";
import familiesRoutes from "./routes/families";
import notificationsRoutes from "./routes/notifications";
import uploadsRoutes from "./routes/uploads";

export function createApp(): Express {
  const app = express();
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(path.resolve(config.uploadsDir)));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "novellia-pets" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/families", familiesRoutes);
  app.use("/api/pets", petsRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/uploads", uploadsRoutes);

  app.use(errorHandler);
  return app;
}
