import { existsSync } from "node:fs";

/** Load .env.local when present (Node 20.12+). Real environment variables win. */
export function loadLocalEnv(): void {
  for (const f of [".env.local", ".env"]) {
    if (existsSync(f)) {
      try {
        process.loadEnvFile(f);
      } catch {
        // ignore unreadable env files
      }
    }
  }
}
