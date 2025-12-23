const { drizzle } = require("drizzle-orm/node-postgres");
const { Client } = require("pg");
require("dotenv").config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("Connecting to database...");
  await client.connect();

  try {
    console.log("Adding missing columns to recipe_items...");

    // 1. Add columns if they don't exist
    await client.query(`
      ALTER TABLE recipe_items 
      ADD COLUMN IF NOT EXISTS unit TEXT
    `);

    await client.query(`
      ALTER TABLE recipe_items 
      ADD COLUMN IF NOT EXISTS base_unit TEXT
    `);

    await client.query(`
      ALTER TABLE recipe_items 
      ADD COLUMN IF NOT EXISTS unit_multiplier NUMERIC DEFAULT 1
    `);

    await client.query(`
      ALTER TABLE recipe_items 
      ADD COLUMN IF NOT EXISTS base_quantity NUMERIC
    `);

    console.log("Columns ensured. Updating existing rows...");

    // 2. Update existing rows by joining with inventory_items
    // We assume legacy recipe items used the same unit as the inventory item's display unit (legacy unit)
    // So we copy the multiplier and base_unit from inventory_items
    // And calculate base_quantity
    
    // Postgres UPDATE with JOIN syntax
    await client.query(`
      UPDATE recipe_items
      SET 
        unit = COALESCE(recipe_items.unit, ii.display_unit),
        base_unit = COALESCE(recipe_items.base_unit, ii.base_unit),
        unit_multiplier = COALESCE(recipe_items.unit_multiplier, ii.unit_multiplier),
        base_quantity = COALESCE(recipe_items.base_quantity, recipe_items.quantity_required * COALESCE(recipe_items.unit_multiplier, ii.unit_multiplier, 1))
      FROM inventory_items ii
      WHERE recipe_items.inventory_item_id = ii.id
      AND (
        recipe_items.unit IS NULL OR 
        recipe_items.base_unit IS NULL OR 
        recipe_items.base_quantity IS NULL
      )
    `);

    console.log("Recipe items updated successfully.");

  } catch (err) {
    console.error("Error updating schema:", err);
  } finally {
    await client.end();
  }
}

main();
