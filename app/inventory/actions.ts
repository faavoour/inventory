"use server";

import { db } from "@/lib/db";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { recipeItems } from "@/db/schema/menu";
import { prepRecipes } from "@/db/schema/prep";
import { auditLogs } from "@/db/schema/auditLogs";
import { eq, or, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deactivateInventoryItem(id: string) {
  await db.update(inventoryItems)
    .set({ isActive: false })
    .where(eq(inventoryItems.id, id));

  await db.insert(auditLogs).values({
    entityType: "INVENTORY_ITEM",
    entityId: id,
    action: "INVENTORY_ITEM_DEACTIVATED",
  });

  revalidatePath("/inventory");
}

export async function reactivateInventoryItem(id: string) {
  await db.update(inventoryItems)
    .set({ isActive: true })
    .where(eq(inventoryItems.id, id));

  await db.insert(auditLogs).values({
    entityType: "INVENTORY_ITEM",
    entityId: id,
    action: "INVENTORY_ITEM_REACTIVATED",
  });

  revalidatePath("/inventory");
}

export async function deleteInventoryItem(id: string) {
  // Double check usage before deleting (security)
  const usageCount = await getInventoryUsageCount(id);
  if (usageCount > 0) {
    throw new Error("Cannot delete inventory item that is in use.");
  }

  await db.delete(inventoryItems).where(eq(inventoryItems.id, id));

  await db.insert(auditLogs).values({
    entityType: "INVENTORY_ITEM",
    entityId: id,
    action: "INVENTORY_ITEM_DELETED",
  });

  revalidatePath("/inventory");
}

async function getInventoryUsageCount(id: string): Promise<number> {
  // Check recipe usage
  const recipeCount = await db
    .select({ id: recipeItems.id })
    .from(recipeItems)
    .where(eq(recipeItems.inventoryItemId, id));

  // Check prep recipe usage
  const prepRecipeCount = await db
    .select({ id: prepRecipes.id })
    .from(prepRecipes)
    .where(eq(prepRecipes.inventoryItemId, id));

  return recipeCount.length + prepRecipeCount.length;
}
