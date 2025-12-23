import dotenv from "dotenv";
import pg from "pg";

dotenv.config();
const { Client } = pg;

async function main() {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    await client.query(
      `CREATE TABLE IF NOT EXISTS expense_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )`
    );
    const res = await client.query(
      "SELECT schemaname, tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename"
    );
    for (const row of res.rows) {
      console.log(`${row.schemaname}.${row.tablename}`);
    }
    console.log("Created/verified table: expense_categories");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
