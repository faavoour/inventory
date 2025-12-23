import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'allocation_entity_type') THEN
          CREATE TYPE allocation_entity_type AS ENUM ('SALE', 'EXPENSE');
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        entity_type allocation_entity_type NOT NULL,
        entity_id UUID NOT NULL,
        payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
        amount NUMERIC NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
    `);
    const { rows: salesRows } = await client.query(`
      SELECT id, total_amount, payment_method_id
      FROM sales
    `);
    for (const s of salesRows) {
      if (s.payment_method_id && s.total_amount && Number(s.total_amount) > 0) {
        const { rows: existing } = await client.query(
          `SELECT id FROM payment_allocations WHERE entity_type = 'SALE' AND entity_id = $1 LIMIT 1`,
          [s.id]
        );
        if (existing.length === 0) {
          await client.query(
            `INSERT INTO payment_allocations (entity_type, entity_id, payment_method_id, amount) VALUES ('SALE', $1, $2, $3)`,
            [s.id, s.payment_method_id, s.total_amount]
          );
        }
      }
    }
    const { rows: expenseRows } = await client.query(`
      SELECT id, amount, payment_method_id
      FROM expenses
    `);
    for (const e of expenseRows) {
      if (e.payment_method_id && e.amount && Number(e.amount) > 0) {
        const { rows: existing } = await client.query(
          `SELECT id FROM payment_allocations WHERE entity_type = 'EXPENSE' AND entity_id = $1 LIMIT 1`,
          [e.id]
        );
        if (existing.length === 0) {
          await client.query(
            `INSERT INTO payment_allocations (entity_type, entity_id, payment_method_id, amount) VALUES ('EXPENSE', $1, $2, $3)`,
            [e.id, e.payment_method_id, e.amount]
          );
        }
      }
    }
    await client.query("COMMIT");
    console.log("payment_allocations table ensured and backfilled.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
