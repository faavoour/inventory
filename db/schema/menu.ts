import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { inventoryItems } from "./inventory";
import { prepItems } from "./prep";

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  price: doublePrecision("price").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recipeItems = pgTable("recipe_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  inventoryItemId: uuid("inventory_item_id")
    .references(() => inventoryItems.id, { onDelete: "restrict" }),
  prepItemId: uuid("prep_item_id")
    .references(() => prepItems.id, { onDelete: "restrict" }),
  quantityRequired: doublePrecision("quantity_required").notNull(),
  unit: text("unit"), // Entered unit (e.g. "g" or "kg")
  unitMultiplier: doublePrecision("unit_multiplier").default(1),
  baseQuantity: doublePrecision("base_quantity"), // Standardized (e.g. in grams)
  baseUnit: text("base_unit"), // The base unit used (e.g. "g")
});

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  recipes: many(recipeItems),
}));

export const recipeItemsRelations = relations(recipeItems, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [recipeItems.menuItemId],
    references: [menuItems.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [recipeItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
  prepItem: one(prepItems, {
    fields: [recipeItems.prepItemId],
    references: [prepItems.id],
  }),
}));

