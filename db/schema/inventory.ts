import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  timestamp,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { recipeItems } from "./menu";
import { sales } from "./sales";
import { suppliers } from "./suppliers";

export const movementTypeEnum = pgEnum("movement_type", [
  "SALE",
  "SALE_REVERSAL",
  "ADJUSTMENT",
  "PREP_CONSUMPTION",
]);

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  quantity: doublePrecision("quantity").notNull().default(0),
  costPerUnit: doublePrecision("cost_per_unit").notNull(),
  
  // Standardized Units
  baseQuantity: doublePrecision("base_quantity"),
  baseUnit: text("base_unit"),
  costPerBaseUnit: doublePrecision("cost_per_base_unit"),
  displayUnit: text("display_unit"),
  unitMultiplier: doublePrecision("unit_multiplier").default(1),
  type: text("type").notNull().default("RAW"),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  changeAmount: doublePrecision("change_amount").notNull(),
  reason: text("reason").notNull(),
  type: movementTypeEnum("type").notNull().default("ADJUSTMENT"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryItemsRelations = relations(inventoryItems, ({ many }) => ({
  movements: many(inventoryMovements),
  recipes: many(recipeItems),
}));

export const inventoryMovementsRelations = relations(
  inventoryMovements,
  ({ one }) => ({
    item: one(inventoryItems, {
      fields: [inventoryMovements.inventoryItemId],
      references: [inventoryItems.id],
    }),
  })
);
