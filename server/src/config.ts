import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/novellia_pets"),
  jwtSecret: required("JWT_SECRET", "dev-change-me-novellia-pets"),
  clientOrigin: required("CLIENT_ORIGIN", "http://localhost:5173"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isDev: (process.env.NODE_ENV ?? "development") !== "production",
  otpTtlMinutes: 10,
  jwtTtl: "7d" as const,
  uploadsDir: path.join(__dirname, "../uploads"),
};
