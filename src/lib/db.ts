import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * SQLite URL handling: the adapter strips the `file:` prefix and resolves the
 * remainder against cwd, exactly like the Prisma CLI does with prisma.config.ts.
 * Both therefore land on the same `<cwd>/dev.db`.
 */
const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
