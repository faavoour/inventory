const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

async function addIsActiveColumn() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    console.log("Connected successfully.");

    try {
      await client.query('BEGIN');

      console.log("Adding is_active column to inventory_items...");
      
      await client.query(`
        ALTER TABLE inventory_items 
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
      `);

      console.log("Column added successfully.");

      await client.query('COMMIT');
      console.log("Migration completed successfully.");

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("Error executing migration:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addIsActiveColumn();
