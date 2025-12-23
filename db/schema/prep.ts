import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { inventoryItems } from "./inventory";
import { sales } from "./sales";

export const prepItems = pgTable("prep_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  baseUnit: text("base_unit").notNull(), // g, ml, pcs
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const prepRecipes = pgTable("prep_recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  prepItemId: uuid("prep_item_id")
    .notNull()
    .references(() => prepItems.id, { onDelete: "cascade" }),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "restrict" }),
  requiredBaseQuantity: doublePrecision("required_base_quantity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const prepInventory = pgTable("prep_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  prepItemId: uuid("prep_item_id")
    .notNull()
    .references(() => prepItems.id, { onDelete: "cascade" }),
  baseQuantity: doublePrecision("base_quantity").notNull().default(0),
  costPerBaseUnit: doublePrecision("cost_per_base_unit").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const prepProductionMovements = pgTable("prep_production_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  prepItemId: uuid("prep_item_id")
    .notNull()
    .references(() => prepItems.id, { onDelete: "cascade" }),
  producedBaseQuantity: doublePrecision("produced_base_quantity").notNull(),
  totalCost: doublePrecision("total_cost").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const prepUsageMovements = pgTable("prep_usage_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  prepItemId: uuid("prep_item_id")
    .notNull()
    .references(() => prepItems.id, { onDelete: "cascade" }),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
  changeAmount: doublePrecision("change_amount").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const prepItemsRelations = relations(prepItems, ({ many, one }) => ({
  recipes: many(prepRecipes),
  stock: one(prepInventory, {
    fields: [prepItems.id],
    references: [prepInventory.prepItemId],
  }),
  movements: many(prepProductionMovements),
  usageMovements: many(prepUsageMovements),
}));

export const prepRecipesRelations = relations(prepRecipes, ({ one }) => ({
  prepItem: one(prepItems, {
    fields: [prepRecipes.prepItemId],
    references: [prepItems.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [prepRecipes.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const prepInventoryRelations = relations(prepInventory, ({ one }) => ({
  prepItem: one(prepItems, {
    fields: [prepInventory.prepItemId],
    references: [prepItems.id],
  }),
}));

export const prepProductionMovementsRelations = relations(prepProductionMovements, ({ one }) => ({
  prepItem: one(prepItems, {
    fields: [prepProductionMovements.prepItemId],
    references: [prepItems.id],
  }),
}));

export const prepUsageMovementsRelations = relations(prepUsageMovements, ({ one }) => ({
  prepItem: one(prepItems, {
    fields: [prepUsageMovements.prepItemId],
    references: [prepItems.id],
  }),
  sale: one(sales, {
    fields: [prepUsageMovements.saleId],
    references: [sales.id],
  }),
}));
