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
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        profit_drop_percent double precision NOT NULL DEFAULT 10,
        expense_spike_percent double precision NOT NULL DEFAULT 150,
        cash_flow_negative_limit double precision NOT NULL DEFAULT 10000,
        inventory_block_count integer NOT NULL DEFAULT 2,
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);
    const res = await client.query(`SELECT id FROM alert_settings LIMIT 1`);
    if (res.rows.length === 0) {
      await client.query(`
        INSERT INTO alert_settings (profit_drop_percent, expense_spike_percent, cash_flow_negative_limit, inventory_block_count)
        VALUES (10, 150, 10000, 2)
      `);
      console.log("Inserted default alert_settings row");
    } else {
      console.log("alert_settings row exists");
    }
    console.log("Created/verified table: alert_settings");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
