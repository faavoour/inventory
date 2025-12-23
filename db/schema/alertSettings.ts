import { pgTable, uuid, doublePrecision, integer, timestamp } from "drizzle-orm/pg-core";

export const alertSettings = pgTable("alert_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  profitDropPercent: doublePrecision("profit_drop_percent").notNull().default(10),
  expenseSpikePercent: doublePrecision("expense_spike_percent").notNull().default(150),
  cashFlowNegativeLimit: doublePrecision("cash_flow_negative_limit").notNull().default(10000),
  inventoryBlockCount: integer("inventory_block_count").notNull().default(2),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
