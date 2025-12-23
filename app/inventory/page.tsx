import { db } from "@/lib/db";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { recipeItems } from "@/db/schema/menu";
import { prepRecipes } from "@/db/schema/prep";
import Link from "next/link";
import { eq, count } from "drizzle-orm";
import InventoryList from "./_components/InventoryList";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ restocked?: string }>;
}) {
  const params = await searchParams;
  const restocked = params?.restocked === "1";

  // Fetch all items sorted by name
  const items = await db
    .select()
    .from(inventoryItems)
    .orderBy(inventoryItems.name);

  // Calculate usage for each item
  // Ideally this should be a single query or fewer queries, but for now loop is acceptable if N is small
  // Optimization: Fetch all counts in bulk if possible, or just do it inside the loop for simplicity given constraints.
  // Better approach: Get all IDs used in recipes, prep, movements.
  
  const usedInRecipes = await db.select({ id: recipeItems.inventoryItemId }).from(recipeItems);
  const usedInPrep = await db.select({ id: prepRecipes.inventoryItemId }).from(prepRecipes);

  const usedSet = new Set<string>();
  usedInRecipes.forEach(r => r.id && usedSet.add(r.id));
  usedInPrep.forEach(p => usedSet.add(p.id));

  const itemsWithUsage = items.map(item => ({
    ...item,
    isUsed: usedSet.has(item.id)
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <div className="text-sm text-muted-foreground">Manage stock levels and costs.</div>
        </div>
        <Link
          className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
          href="/inventory/new"
        >
          Add Inventory Item
        </Link>
      </div>

      <div className="flex border-b">
        <div className="flex space-x-6">
          <div className="border-b-2 border-primary px-2 py-2 text-sm font-medium">
            Raw Ingredients
          </div>
          <Link 
            href="/prep" 
            className="px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Prep Items
          </Link>
        </div>
      </div>

      {restocked && (
        <div className="border border-success/20 bg-success/15 text-success p-3 rounded-md">
          Inventory restocked successfully.
        </div>
      )}

      <InventoryList initialItems={itemsWithUsage} />
    </div>
  );
}
