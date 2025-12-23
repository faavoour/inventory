"use server";

import { db } from "@/lib/db";
import { prepItems, prepInventory, prepRecipes, prepProductionMovements } from "@/db/schema/prep";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { recipeItems } from "@/db/schema/menu";
import { eq, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auditLogs } from "@/db/schema/auditLogs";

type IngredientInput = {
  inventoryItemId: string;
  quantity: number;
};

type CreatePrepItemInput = {
  name: string;
  yieldQuantity: number;
  yieldUnit: string;
  ingredients: IngredientInput[];
};

export async function createPrepItemAction(data: CreatePrepItemInput) {
  const { name, yieldQuantity, yieldUnit, ingredients } = data;

  if (!name || yieldQuantity <= 0 || ingredients.length === 0) {
    throw new Error("Invalid input");
  }

  await db.transaction(async (tx) => {
    // 1. Create Prep Item Definition
    const [newItem] = await tx
      .insert(prepItems)
      .values({
        name,
        baseUnit: yieldUnit,
        isActive: true,
      })
      .returning();

    let totalCost = 0;
    const ingredientSnapshots: Array<{ name: string; quantity: number; cost: number }> = [];

    // 2. Process Ingredients
    for (const ing of ingredients) {
      const [invItem] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, ing.inventoryItemId));

      if (!invItem) throw new Error(`Inventory item ${ing.inventoryItemId} not found`);

      // Calculate quantity in base unit
      // User input is ALWAYS in display unit (e.g. kg, L, pcs)
      // System converts to base unit (e.g. g, ml, pcs)
      const quantityInBase = ing.quantity * (invItem.unitMultiplier || 1);

      // Calculate cost
      const cost = quantityInBase * (invItem.costPerBaseUnit || 0);
      totalCost += cost;
      
      ingredientSnapshots.push({
        name: invItem.name,
        quantity: quantityInBase,
        cost: cost
      });

      // Deduct from Inventory
      // We deduct from baseQuantity
      const newBaseQty = (invItem.baseQuantity || 0) - quantityInBase;
      const newDisplayQty = newBaseQty / (invItem.unitMultiplier || 1);

      await tx
        .update(inventoryItems)
        .set({
          baseQuantity: newBaseQty,
          quantity: newDisplayQty,
        })
        .where(eq(inventoryItems.id, invItem.id));

      // Record Movement
      await tx.insert(inventoryMovements).values({
        inventoryItemId: invItem.id,
        changeAmount: -quantityInBase, // Negative for deduction
        reason: `Used for prep: ${name}`,
        type: "PREP_CONSUMPTION",
      });

      // Save Recipe Link (Snapshot of what was used)
      await tx.insert(prepRecipes).values({
        prepItemId: newItem.id,
        inventoryItemId: invItem.id,
        requiredBaseQuantity: quantityInBase, 
      });
    }

    // 3. Create Prep Inventory
    const costPerUnit = totalCost / yieldQuantity;

    await tx.insert(prepInventory).values({
      prepItemId: newItem.id,
      baseQuantity: yieldQuantity,
      costPerBaseUnit: costPerUnit,
    });

    // 4. Record Production Movement
    await tx.insert(prepProductionMovements).values({
      prepItemId: newItem.id,
      producedBaseQuantity: yieldQuantity,
      totalCost: totalCost,
    });

    // 5. Audit Log
    await tx.insert(auditLogs).values({
      entityType: "PREP_ITEM",
      entityId: newItem.id,
      action: "CREATED",
      actor: "system", // TODO: Get real user
      afterData: {
        name,
        yieldQuantity,
        yieldUnit,
        message: `Created prep item: ${name} (${yieldQuantity} ${yieldUnit})`
      },
    });
  });

  revalidatePath("/prep");
  redirect("/prep");
}

export async function deletePrepItemAction(id: string) {
  // Check usage
  const result = await db
    .select({ count: count(recipeItems.id) })
    .from(recipeItems)
    .where(eq(recipeItems.prepItemId, id));

  if (result[0].count > 0) {
    throw new Error("Cannot delete prep item that is used in menu recipes. Deactivate it instead.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(prepItems).where(eq(prepItems.id, id));
    
    await tx.insert(auditLogs).values({
      entityType: "PREP_ITEM",
      entityId: id,
      action: "DELETED",
      actor: "system",
      afterData: { message: "Deleted prep item" },
    });
  });

  revalidatePath("/prep");
}

export async function togglePrepItemStatusAction(id: string, isActive: boolean) {
  await db.transaction(async (tx) => {
    await tx
      .update(prepItems)
      .set({ isActive })
      .where(eq(prepItems.id, id));

    await tx.insert(auditLogs).values({
      entityType: "PREP_ITEM",
      entityId: id,
      action: isActive ? "REACTIVATED" : "DEACTIVATED",
      actor: "system",
      afterData: { 
        isActive,
        message: `${isActive ? "Reactivated" : "Deactivated"} prep item`
      },
    });
  });

  revalidatePath("/prep");
}

export async function addPrepBatchAction(
  prepItemId: string, 
  batchYield: number, 
  ingredients: { inventoryItemId: string; quantity: number }[]
) {
  if (!prepItemId) throw new Error("Prep item ID is required");
  if (batchYield <= 0) throw new Error("Batch yield must be greater than 0");
  if (ingredients.length === 0) throw new Error("At least one ingredient is required");

  await db.transaction(async (tx) => {
    // 1. Get Prep Item & Inventory
    const [prepItem] = await tx
      .select({ 
        id: prepItems.id, 
        name: prepItems.name,
        baseUnit: prepItems.baseUnit,
        isActive: prepItems.isActive 
      })
      .from(prepItems)
      .where(eq(prepItems.id, prepItemId));

    if (!prepItem) throw new Error("Prep item not found");
    if (!prepItem.isActive) throw new Error("Cannot add batch to inactive prep item");

    const [existingInventory] = await tx
      .select()
      .from(prepInventory)
      .where(eq(prepInventory.prepItemId, prepItemId));

    // 2. Process Ingredients (Deduct & Calculate Cost)
    let totalBatchCost = 0;

    for (const ing of ingredients) {
      if (ing.quantity <= 0) throw new Error("Ingredient quantity must be greater than 0");

      const [invItem] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, ing.inventoryItemId));

      if (!invItem) throw new Error(`Inventory item ${ing.inventoryItemId} not found`);

      // Cost Calculation
      const cost = ing.quantity * (invItem.costPerBaseUnit || 0);
      totalBatchCost += cost;

      // Deduct from Raw Inventory
      const newBaseQty = (invItem.baseQuantity || 0) - ing.quantity;
      const newDisplayQty = newBaseQty / (invItem.unitMultiplier || 1); // Approximate display update

      await tx
        .update(inventoryItems)
        .set({
          baseQuantity: newBaseQty,
          quantity: newDisplayQty,
        })
        .where(eq(inventoryItems.id, invItem.id));

      // Record Movement
      await tx.insert(inventoryMovements).values({
        inventoryItemId: invItem.id,
        changeAmount: -ing.quantity,
        reason: `Used for prep batch: ${prepItem.name}`,
        type: "PREP_CONSUMPTION",
      });
    }

    // 3. Update Prep Inventory (Weighted Average)
    const oldQty = existingInventory?.baseQuantity || 0;
    const oldCost = existingInventory?.costPerBaseUnit || 0;
    const oldTotalValue = oldQty * oldCost;
    
    const newTotalQty = oldQty + batchYield;
    const newTotalValue = oldTotalValue + totalBatchCost;
    const newCostPerUnit = newTotalQty > 0 ? newTotalValue / newTotalQty : 0;

    if (existingInventory) {
      await tx
        .update(prepInventory)
        .set({
          baseQuantity: newTotalQty,
          costPerBaseUnit: newCostPerUnit,
        })
        .where(eq(prepInventory.id, existingInventory.id));
    } else {
      await tx.insert(prepInventory).values({
        prepItemId: prepItemId,
        baseQuantity: newTotalQty,
        costPerBaseUnit: newCostPerUnit,
      });
    }

    // 4. Record Production Movement
    await tx.insert(prepProductionMovements).values({
      prepItemId: prepItemId,
      producedBaseQuantity: batchYield,
      totalCost: totalBatchCost,
    });

    // 5. Audit Log
    await tx.insert(auditLogs).values({
      entityType: "PREP_ITEM",
      entityId: prepItemId,
      action: "BATCH_ADDED",
      actor: "system",
      afterData: {
        batchYield,
        unit: prepItem.baseUnit,
        totalCost: totalBatchCost,
        message: `Added prep batch (${batchYield} ${prepItem.baseUnit})`
      },
    });
  });

  revalidatePath("/prep");
  redirect("/prep");
}
