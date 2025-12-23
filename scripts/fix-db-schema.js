const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' }); // Try .env.local first
require('dotenv').config(); // Then .env

async function fixDatabase() {
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

      console.log("Checking and adding missing columns to inventory_items...");

      // 1. display_unit
      await client.query(`
        ALTER TABLE inventory_items 
        ADD COLUMN IF NOT EXISTS display_unit TEXT DEFAULT 'pcs'
      `);

      // 2. base_unit
      await client.query(`
        ALTER TABLE inventory_items 
        ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'pcs'
      `);

      // 3. unit_multiplier
      await client.query(`
        ALTER TABLE inventory_items 
        ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC DEFAULT 1
      `);

      // 4. base_quantity (nullable initially, but we might want to fill it)
      await client.query(`
        ALTER TABLE inventory_items 
        ADD COLUMN IF NOT EXISTS base_quantity DOUBLE PRECISION
      `);

      // 5. cost_per_base_unit (nullable initially)
      await client.query(`
        ALTER TABLE inventory_items 
        ADD COLUMN IF NOT EXISTS cost_per_base_unit DOUBLE PRECISION
      `);

      console.log("Columns ensured. Updating existing rows...");

      // Update defaults for existing rows
      // display_unit = unit (or 'pcs' if null)
      // base_unit = display_unit (since we assume existing items are already in their "base" form or standard form)
      // unit_multiplier = 1
      // base_quantity = quantity (since multiplier is 1)
      // cost_per_base_unit = cost_per_unit (since multiplier is 1)
      
      await client.query(`
        UPDATE inventory_items
        SET 
          display_unit = COALESCE(unit, 'pcs'),
          base_unit = COALESCE(unit, 'pcs'),
          unit_multiplier = 1,
          base_quantity = quantity,
          cost_per_base_unit = cost_per_unit
        WHERE display_unit IS NULL OR base_unit IS NULL OR unit_multiplier IS NULL OR base_quantity IS NULL
      `);

      // Also ensure NOT NULL constraints where appropriate if desired, but user said "Add missing columns... DO NOT DROP OR ALTER existing columns" in a risky way.
      // But we can set defaults. The ALTER statements above set defaults for *new* rows, but existing rows might need the UPDATE we just did.
      
      await client.query('COMMIT');
      console.log("Database safety patch completed successfully.");

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("Error executing database patch:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixDatabase();
