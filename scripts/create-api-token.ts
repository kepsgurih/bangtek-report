import { Pool } from "pg";
import { createApiToken } from "../lib/api-token";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
const name = process.argv[2]?.trim() || "hermes";
const created = createApiToken();
try {
  await pool.query(
    `insert into bangtek_api_token (name, token_hash) values ($1,$2)
     on conflict (name) do update set token_hash=excluded.token_hash, created_at=now()`,
    [name, created.tokenHash],
  );
  console.log(created.token);
} finally {
  await pool.end();
}
