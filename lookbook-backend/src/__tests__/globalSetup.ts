import { MongoMemoryServer } from "mongodb-memory-server";

// Runs once in Jest's orchestrator process before any worker spawns, so
// setting process.env.MONGO_URI here is inherited by every test worker —
// meaning config/env.ts (which reads it once at import time) always sees
// the in-memory DB, never the real Atlas cluster.
export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create();
  (globalThis as unknown as { __MONGOD__: MongoMemoryServer }).__MONGOD__ = mongod;
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = "test_jwt_secret";
  process.env.JWT_REFRESH_SECRET = "test_jwt_refresh_secret";
  // Without this, config/redis.ts and the BullMQ queues connect to the real
  // Redis Cloud instance from .env — the lingering connection (retrying
  // indefinitely against a network Jest has torn down) is exactly what kept
  // the whole test process hanging open long after all tests had finished.
  process.env.REDIS_URL = "";
}
