import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { paymentMethods } from "./paymentMethods";
import { expenseCategories } from "./expenseCategories";

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { mode: "number" }).notNull(),
  expenseDate: date("expense_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Legacy: deprecated — use payment_allocations for payment method and amounts
  paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, { onDelete: "set null" }),
  expenseCategoryId: uuid("expense_category_id").references(() => expenseCategories.id, { onDelete: "set null" }),
});
