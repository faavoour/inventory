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
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query(
      `DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'public.expenses'::regclass
            AND confrelid = 'public.expense_categories'::regclass
        LOOP
          EXECUTE format('ALTER TABLE public.expenses DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END
      $$;`
    );
    const colRes = await client.query(
      `SELECT data_type
       FROM information_schema.columns
       WHERE table_name='expenses' AND column_name='expense_category_id'`
    );
    if (colRes.rowCount === 0) {
      await client.query(
        `ALTER TABLE expenses ADD COLUMN expense_category_id UUID`
      );
    } else if (colRes.rows[0]?.data_type === "text") {
      await client.query(
        `ALTER TABLE expenses
         ALTER COLUMN expense_category_id TYPE UUID
         USING expense_category_id::uuid`
      );
    }
    await client.query(
      `ALTER TABLE expense_categories
       ALTER COLUMN id TYPE UUID
       USING id::uuid`
    );
    await client.query(
      `ALTER TABLE expense_categories
       ALTER COLUMN id SET DEFAULT uuid_generate_v4()`
    );
    await client.query(
      `ALTER TABLE expenses
       ADD CONSTRAINT expenses_expense_category_id_expense_categories_id_fk
       FOREIGN KEY (expense_category_id)
       REFERENCES expense_categories(id)
       ON DELETE SET NULL`
    );
    const res = await client.query(
      `SELECT data_type, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_name='expense_categories' AND column_name='id'`
    );
    console.log(res.rows[0]);
    console.log("expense_categories.id altered to UUID with default uuid_generate_v4()");
    const expCol = await client.query(
      `SELECT data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name='expenses' AND column_name='expense_category_id'`
    );
    console.log(expCol.rows[0]);
    console.log("expenses.expense_category_id ready with FK to expense_categories(id)");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
