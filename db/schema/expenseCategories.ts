import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({
    nameUnique: uniqueIndex("expense_categories_name_unique").on(t.name),
  })
);

