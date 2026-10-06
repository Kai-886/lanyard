function read(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export const env = {
  /** SQLite by default; swap the URL + Prisma provider for Postgres (see ADR-002). */
  databaseUrl: read("DATABASE_URL", "file:./dev.db"),
  appUrl: read("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  aiProvider: read("AI_PROVIDER", "openai") as "openai" | "anthropic" | "google",
  aiApiKey: read("AI_API_KEY"),
  aiModel: read("AI_MODEL", "gpt-4o-mini"),
  aiRateLimit: Number(read("AI_RATE_LIMIT_PER_MIN", "10")) || 10,

  /** Force deterministic local output — used by tests, CI and screenshots. */
  get aiMock() {
    return process.env.AI_MOCK === "1";
  },

  appPasscode: read("APP_PASSCODE"),
  /** Sign-off name used in drafted messages. Empty means a bare sign-off. */
  senderName: read("SENDER_NAME"),
};

/** Live model available? Mock mode still works; no key at all means "not configured". */
export function aiAvailability(): "live" | "mock" | "off" {
  if (env.aiMock) return "mock";
  if (env.aiApiKey) return "live";
  return "off";
}
