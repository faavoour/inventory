import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function ensureUnknownMethod(client) {
  const { rows } = await client.query(
    `SELECT id FROM payment_methods WHERE name = $1 LIMIT 1`,
    ["Unknown / Legacy"]
  );
  if (rows.length > 0) return rows[0].id;
  const inserted = await client.query(
    `INSERT INTO payment_methods (name, is_active) VALUES ($1, true) RETURNING id`,
    ["Unknown / Legacy"]
  );
  return inserted.rows[0].id;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const unknownId = await ensureUnknownMethod(client);

    const { rows: invalidAllocations } = await client.query(
      `
      SELECT pa.id, pa.entity_type, pa.entity_id, pa.payment_method_id
      FROM payment_allocations pa
      LEFT JOIN payment_methods pm ON pa.payment_method_id = pm.id
      WHERE pa.payment_method_id IS NULL OR pm.id IS NULL
      `
    );

    for (const a of invalidAllocations) {
      let inferred = null;
      if (a.entity_type === "SALE") {
        const { rows } = await client.query(
          `SELECT payment_method_id FROM sales WHERE id = $1 LIMIT 1`,
          [a.entity_id]
        );
        const legacy = rows[0]?.payment_method_id || null;
        if (legacy) {
          const { rows: exists } = await client.query(
            `SELECT 1 FROM payment_methods WHERE id = $1 LIMIT 1`,
            [legacy]
          );
          if (exists.length > 0) inferred = legacy;
        }
      } else if (a.entity_type === "EXPENSE") {
        const { rows } = await client.query(
          `SELECT payment_method_id FROM expenses WHERE id = $1 LIMIT 1`,
          [a.entity_id]
        );
        const legacy = rows[0]?.payment_method_id || null;
        if (legacy) {
          const { rows: exists } = await client.query(
            `SELECT 1 FROM payment_methods WHERE id = $1 LIMIT 1`,
            [legacy]
          );
          if (exists.length > 0) inferred = legacy;
        }
      }
      const useId = inferred || unknownId;
      await client.query(
        `UPDATE payment_allocations SET payment_method_id = $1 WHERE id = $2`,
        [useId, a.id]
      );
    }

    await client.query("COMMIT");
    console.log(`Fixed ${invalidAllocations.length} unassigned payment allocations.`);
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

