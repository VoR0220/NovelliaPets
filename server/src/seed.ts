import mongoose from "mongoose";
import { config } from "./config";
import { formatSeedSummary, runSeed } from "./seedData";

async function main(): Promise<void> {
  await mongoose.connect(config.mongoUri);
  console.log("Connected. Clearing existing data…");
  const seed = await runSeed();
  console.log(formatSeedSummary(seed));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
