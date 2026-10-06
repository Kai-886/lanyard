import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env for the config file.
try {
  process.loadEnvFile();
} catch {
  /* no .env — DATABASE_URL falls through to the default below */
}

/**
 * Prisma 7 moved connection URLs out of schema.prisma into this file.
 * DATABASE_URL must be a Postgres connection string (provider is `postgresql`);
 * the fallback is a conventional local cluster for `db:push` during development.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL") ??
      "postgresql://postgres:postgres@localhost:5432/lanyard?schema=public",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
