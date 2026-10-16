import path from "path";
import { afterAll, beforeAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-jwt-secret-novellia";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
// Placeholder until memory server starts; tests connect via mongoose directly.
process.env.MONGODB_URI =
  "mongodb://127.0.0.1:27017/novellia_pets_test_placeholder";
process.env.MONGOMS_DOWNLOAD_DIR = path.join(
  process.cwd(),
  ".cache/mongodb-binaries"
);

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongo) {
    await mongo.stop();
  }
});
