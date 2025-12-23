import { pgTable, uuid, text, numeric, boolean, timestamp, date } from "drizzle-orm/pg-core";

export const recurringExpenses = pgTable("recurring_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  category: text("category").default("Operating Expense"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(), // MONTHLY | YEARLY
  startDate: date("start_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
