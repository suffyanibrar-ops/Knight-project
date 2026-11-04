import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * The connection string is read exclusively from the DATABASE_URL environment
 * variable — no credentials are hardcoded anywhere in the repository. This works
 * the same locally (.env) and on any hosted Postgres (Neon, Supabase, RDS,
 * Railway, Render, Cloud SQL, Netlify DB…).
 *
 *   npx drizzle-kit push        # apply src/db/schema.ts
 *   npx drizzle-kit generate    # create SQL migrations
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Add it to your .env file locally, or to your hosting provider's environment variables, then re-run the command.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
  verbose: true,
  strict: false,
});
