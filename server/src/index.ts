import mongoose from "mongoose";
import { config } from "./config";
import { createApp } from "./app";

async function main(): Promise<void> {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Novellia Pets API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
