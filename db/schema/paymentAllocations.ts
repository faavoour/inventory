import { pgTable, uuid, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { paymentMethods } from "./paymentMethods";

export const allocationEntityEnum = pgEnum("allocation_entity_type", ["SALE", "EXPENSE"]);

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: allocationEntityEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  paymentMethodId: uuid("payment_method_id")
    .notNull()
    .references(() => paymentMethods.id, { onDelete: "restrict" }),
  amount: numeric("amount", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
