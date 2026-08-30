/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  globalSetup: "<rootDir>/__tests__/globalSetup.ts",
  globalTeardown: "<rootDir>/__tests__/globalTeardown.ts",
  testTimeout: 30000,
  // Safety net: even with Redis disabled in tests (see globalSetup), don't
  // let any other stray open handle keep the process alive indefinitely.
  forceExit: true,
  // Tests share one in-memory Mongo instance across files but run serially
  // to avoid clashing on shared collections (categories, seeded data).
  maxWorkers: 1,
};
