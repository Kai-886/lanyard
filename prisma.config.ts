import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env for the config file.
try {
  process.loadEnvFile();
} catch {
  /* no .env — DATABASE_URL falls through to the default below */
}

/**
 * Prisma 7 moved connection URLs out of schema.prisma into this file.
 * DATABASE_URL is resolved relative to the `prisma/` directory, matching the
 * classic `file:./dev.db` convention, so the CLI and the app agree on one file.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL") ?? "file:./dev.db",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
