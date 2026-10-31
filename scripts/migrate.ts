import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("PostgreSQL migrations applied successfully.");
} catch (error) {
  // Do not print connection strings, SQL parameters, or authentication errors.
  console.error(
    "Migration failed. Check PostgreSQL connectivity and credentials.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
