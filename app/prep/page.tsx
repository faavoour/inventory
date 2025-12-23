import { db } from "@/lib/db";
import { prepItems, prepInventory, prepRecipes } from "@/db/schema/prep";
import { recipeItems } from "@/db/schema/menu";
import { inventoryItems } from "@/db/schema/inventory";
import { eq, count, inArray } from "drizzle-orm";
import Link from "next/link";
import PrepInventoryTable from "./PrepInventoryTable";

export const dynamic = "force-dynamic";

export default async function PrepInventoryPage() {
  const items = await db
    .select({
      id: prepItems.id,
      name: prepItems.name,
      baseUnit: prepItems.baseUnit,
      isActive: prepItems.isActive,
      stock: prepInventory.baseQuantity,
      cost: prepInventory.costPerBaseUnit,
      usageCount: count(recipeItems.id),
    })
    .from(prepItems)
    .leftJoin(prepInventory, eq(prepItems.id, prepInventory.prepItemId))
    .leftJoin(recipeItems, eq(prepItems.id, recipeItems.prepItemId))
    .groupBy(prepItems.id, prepItems.name, prepItems.baseUnit, prepItems.isActive, prepInventory.baseQuantity, prepInventory.costPerBaseUnit);

  // Fetch recipes for these items
  const itemIds = items.map(i => i.id);
  
  let recipes: any[] = [];
  if (itemIds.length > 0) {
    recipes = await db
      .select({
        prepItemId: prepRecipes.prepItemId,
        inventoryItemName: inventoryItems.name,
        inventoryItemUnit: inventoryItems.unit, // assuming base unit is stored in unit or baseUnit, checking schema...
        // inventoryItems usually has unit and baseUnit. Let's check schema.
        // Wait, I should double check inventory schema to be sure about unit field name for base unit.
        // In previous tools I saw 'unit' and 'baseUnit'. Let's select both and use logic or just 'unit' if it is the base unit.
        // The prompt says "Display quantities in BASE UNITS". 
        // inventory_items table usually has 'unit' which IS the base unit for raw ingredients?
        // Let's assume 'unit' is the base unit for now as per previous context "Lucy Inventory uses base units internally".
        requiredQuantity: prepRecipes.requiredBaseQuantity,
        costPerUnit: inventoryItems.costPerUnit,
      })
      .from(prepRecipes)
      .innerJoin(inventoryItems, eq(prepRecipes.inventoryItemId, inventoryItems.id))
      .where(inArray(prepRecipes.prepItemId, itemIds));
  }

  // Combine data
  const itemsWithRecipes = items.map(item => {
    const itemRecipes = recipes.filter(r => r.prepItemId === item.id).map(r => ({
      inventoryItemName: r.inventoryItemName,
      inventoryItemUnit: r.inventoryItemUnit,
      requiredQuantity: r.requiredQuantity,
      cost: r.requiredQuantity * (r.costPerUnit || 0)
    }));
    
    return {
      ...item,
      stock: item.stock || 0,
      cost: item.cost || 0,
      recipe: itemRecipes
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Prep Inventory</h1>
          <div className="text-sm text-muted-foreground">Manage prepared items and recipes.</div>
        </div>
        <Link
            href="/prep/new"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
          >
            Add Prep Item
          </Link>
      </div>

      <div className="hidden">
        {/* Navigation removed as per requirement - Prep Page is now standalone or embedded */}
      </div>

      <PrepInventoryTable items={itemsWithRecipes} />
    </div>
  );
}
