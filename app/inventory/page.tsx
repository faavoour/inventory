import { db } from "@/lib/db";
import { inventoryItems } from "@/db/schema/inventory";
import { recipeItems } from "@/db/schema/menu";
import { prepRecipes, prepItems, prepInventory } from "@/db/schema/prep";
import Link from "next/link";
import { eq } from "drizzle-orm";
import InventoryList from "./_components/InventoryList";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ restocked?: string }>;
}) {
  const params = await searchParams;
  const restocked = params?.restocked === "1";

  // 1. Fetch ALL inventory items (Raw + Packaging)
  const invItems = await db
    .select()
    .from(inventoryItems)
    .orderBy(inventoryItems.name);

  // 2. Fetch ALL prep items (Prep)
  // Join with prepInventory to get quantity/cost
  const pItems = await db
    .select({
      id: prepItems.id,
      name: prepItems.name,
      baseUnit: prepItems.baseUnit,
      isActive: prepItems.isActive,
      baseQuantity: prepInventory.baseQuantity,
      costPerBaseUnit: prepInventory.costPerBaseUnit,
    })
    .from(prepItems)
    .leftJoin(prepInventory, eq(prepItems.id, prepInventory.prepItemId));

  // 3. Usage calculations
  const rItems = await db.select({ invId: recipeItems.inventoryItemId, prepId: recipeItems.prepItemId }).from(recipeItems);
  const pRecipes = await db.select({ invId: prepRecipes.inventoryItemId }).from(prepRecipes);

  const invUsedSet = new Set<string>();
  const prepUsedSet = new Set<string>();

  rItems.forEach(r => {
    if (r.invId) invUsedSet.add(r.invId);
    if (r.prepId) prepUsedSet.add(r.prepId);
  });
  pRecipes.forEach(p => {
    if (p.invId) invUsedSet.add(p.invId);
  });

  // 4. Combine into master list
  const combinedItems = [
    ...invItems.map((i) => ({
      ...i,
      type: i.type as "RAW" | "PACKAGING" | "PREP",
      isUsed: invUsedSet.has(i.id),
    })),
    ...pItems.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.baseUnit,
      quantity: p.baseQuantity || 0,
      costPerUnit: p.costPerBaseUnit || 0,
      baseUnit: p.baseUnit,
      baseQuantity: p.baseQuantity || 0,
      costPerBaseUnit: p.costPerBaseUnit || 0,
      isActive: p.isActive,
      type: "PREP" as const,
      isUsed: prepUsedSet.has(p.id),
      displayUnit: null,
      unitMultiplier: null,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  // 5. Detailed Prep Items for Prep Manager Tab
  const allPrepRecipes = await db
    .select({
      prepItemId: prepRecipes.prepItemId,
      inventoryItemName: inventoryItems.name,
      inventoryItemUnit: inventoryItems.unit,
      requiredQuantity: prepRecipes.requiredBaseQuantity,
      costPerUnit: inventoryItems.costPerUnit,
    })
    .from(prepRecipes)
    .innerJoin(inventoryItems, eq(prepRecipes.inventoryItemId, inventoryItems.id));

  const detailedPrepItems = pItems.map((p) => {
    const recipes = allPrepRecipes
      .filter((r) => r.prepItemId === p.id)
      .map((r) => ({
        inventoryItemName: r.inventoryItemName,
        inventoryItemUnit: r.inventoryItemUnit,
        requiredQuantity: r.requiredQuantity,
        cost: r.requiredQuantity * (r.costPerUnit || 0),
      }));

    const usageCount = rItems.filter((r) => r.prepId === p.id).length;

    return {
      id: p.id,
      name: p.name,
      baseUnit: p.baseUnit,
      isActive: p.isActive,
      stock: p.baseQuantity || 0,
      cost: p.costPerBaseUnit || 0,
      usageCount,
      recipe: recipes,
    };
  });

  return (
    <InventoryList 
      initialItems={combinedItems} 
      prepItems={detailedPrepItems}
      restocked={restocked} 
    />
  );
}
