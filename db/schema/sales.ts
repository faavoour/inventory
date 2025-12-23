import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  timestamp,
  integer,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { menuItems } from "./menu";
import { paymentMethods } from "./paymentMethods";

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  totalAmount: numeric("total_amount", { mode: "number" }).notNull(),
  saleDate: date("sale_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Legacy: deprecated — use payment_allocations for payment method and amounts
  paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, { onDelete: "restrict" }),
});

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { mode: "number" }).notNull(),
  totalPrice: numeric("total_price", { mode: "number" }).notNull(),
});

export const salesRelations = relations(sales, ({ many, one }) => ({
  items: many(saleItems),
  paymentMethod: one(paymentMethods, {
    fields: [sales.paymentMethodId],
    references: [paymentMethods.id],
  }),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  menuItem: one(menuItems, {
    fields: [saleItems.menuItemId],
    references: [menuItems.id],
  }),
}));
