import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as inventorySchema from "../db/schema/inventory";
import * as menuSchema from "../db/schema/menu";
import * as salesSchema from "../db/schema/sales";
import * as expensesSchema from "../db/schema/expenses";
import * as paymentMethodsSchema from "../db/schema/paymentMethods";
import * as expenseCategoriesSchema from "../db/schema/expenseCategories";
import * as alertSettingsSchema from "../db/schema/alertSettings";
import * as paymentAllocationsSchema from "../db/schema/paymentAllocations";
import * as prepSchema from "../db/schema/prep";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, {
  schema: {
    ...inventorySchema,
    ...menuSchema,
    ...salesSchema,
    ...expensesSchema,
    ...paymentMethodsSchema,
    ...expenseCategoriesSchema,
    ...alertSettingsSchema,
    ...paymentAllocationsSchema,
    ...prepSchema,
  },
});
