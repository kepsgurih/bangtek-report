import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { bangtekPool?: Pool };
export const pool = globalDb.bangtekPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 20000 });
if (process.env.NODE_ENV !== "production") globalDb.bangtekPool = pool;
export const db = drizzle(pool, { schema });
