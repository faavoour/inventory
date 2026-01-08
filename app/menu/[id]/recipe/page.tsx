import { db } from "@/lib/db";
import { inventoryItems } from "@/db/schema/inventory";
import { prepItems } from "@/db/schema/prep";
import { menuItems, recipeItems } from "@/db/schema/menu";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import AddRecipeItemForm from "./AddRecipeItemForm";
import RemoveRecipeItemButton from "./RemoveRecipeItemButton";
import { formatBaseQuantity } from "@/lib/baseUnitDisplay";

type ActionState = { error?: string };

export async function addRecipeItem(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const menuId = String(formData.get("menuId") || "");
  const sourceType = String(formData.get("sourceType") || "RAW");
  const itemId = String(formData.get("itemId") || "");
  const qtyStr = String(formData.get("quantityRequired") || "").trim();
  const quantityRequired = Number(qtyStr);

  if (!menuId) return { error: "Invalid menu id." };
  if (!itemId) return { error: "Select an item." };
  if (Number.isNaN(quantityRequired) || quantityRequired <= 0)
    return { error: "Quantity must be greater than 0." };

  let baseUnit = "";
  let inventoryItemId: string | null = null;
  let prepItemId: string | null = null;
  let finalSourceType = sourceType;

  if (finalSourceType === "PREP") {
    const prep = await db
      .select({ id: prepItems.id, baseUnit: prepItems.baseUnit })
      .from(prepItems)
      .where(eq(prepItems.id, itemId))
      .limit(1);
    if (prep.length === 0) return { error: "Prep item not found." };
    baseUnit = prep[0].baseUnit;
    prepItemId = itemId;
  } else {
    // RAW or PACKAGING -> Inventory
    const inv = await db
      .select({ 
        id: inventoryItems.id,
        unit: inventoryItems.unit,
        baseUnit: inventoryItems.baseUnit,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId))
      .limit(1);
    
    if (inv.length > 0) {
      baseUnit = inv[0].baseUnit || inv[0].unit;
      inventoryItemId = itemId;
    } else {
      // Fallback: Check if it's actually a Prep Item (fixes "Inventory item not found" bug if UI sends RAW)
      const prep = await db
        .select({ id: prepItems.id, baseUnit: prepItems.baseUnit })
        .from(prepItems)
        .where(eq(prepItems.id, itemId))
        .limit(1);
      
      if (prep.length > 0) {
        baseUnit = prep[0].baseUnit;
        prepItemId = itemId;
        finalSourceType = "PREP";
      } else {
        return { error: "Inventory item not found." };
      }
    }
  }

  // Enforce base unit usage
  const unit = baseUnit;
  const unitMultiplier = 1;
  const baseQuantity = quantityRequired; // Since unit is base unit

  await db.insert(recipeItems).values({
    menuItemId: menuId,
    inventoryItemId,
    prepItemId,
    sourceType: finalSourceType,
    quantityRequired,
    unit,
    unitMultiplier,
    baseQuantity,
    baseUnit,
  });

  revalidatePath(`/menu/${menuId}/recipe`);
  redirect(`/menu/${menuId}/recipe`);
}

export async function removeRecipeItem(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  // Find menu id for revalidation
  const row = await db
    .select({ menuItemId: recipeItems.menuItemId })
    .from(recipeItems)
    .where(eq(recipeItems.id, id))
    .limit(1);
  await db.delete(recipeItems).where(eq(recipeItems.id, id));
  const menuId = row[0]?.menuItemId;
  if (menuId) {
    revalidatePath(`/menu/${menuId}/recipe`);
    redirect(`/menu/${menuId}/recipe`);
  } else {
    revalidatePath(`/menu`);
    redirect(`/menu`);
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const itemRows = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, id))
    .limit(1);
  if (itemRows.length === 0) {
    notFound();
  }
  const menuItem = itemRows[0];

  const inventory = await db
    .select()
    .from(inventoryItems)
    .orderBy(asc(inventoryItems.name));
  const inventoryById = new Map(inventory.map((i) => [i.id, i]));
  const activeInventory = inventory.filter((i) => i.isActive);

  const prep = await db
    .select()
    .from(prepItems)
    .orderBy(asc(prepItems.name));
  const prepById = new Map(prep.map((p) => [p.id, p]));

  const recipes = await db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.menuItemId, id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipe for: {menuItem.name}</h1>
        <Link className="text-primary underline hover:text-primary/80" href="/menu">
          Back to Menu
        </Link>
      </div>

      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-lg font-medium mb-3">Add Ingredient</h2>
        <AddRecipeItemForm
          action={addRecipeItem}
          inventory={[
            ...activeInventory.map((i) => ({
              id: i.id,
              name: i.name,
              unit: i.baseUnit || i.unit, // Use base unit only
              costPerUnit: i.costPerBaseUnit || i.costPerUnit,
              type: i.type || "RAW",
            })),
            ...prep.map((p) => ({
              id: p.id,
              name: p.name,
              unit: p.baseUnit,
              costPerUnit: 0,
              type: "PREP",
            })),
          ]}
          menuItemId={id}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Ingredients</h2>
        {recipes.length === 0 ? (
          <div className="text-muted-foreground text-sm italic">
            No ingredients added yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {recipes.map((r) => {
              const inv = r.inventoryItemId ? inventoryById.get(r.inventoryItemId) : null;
              const pItem = r.prepItemId ? prepById.get(r.prepItemId) : null;
              const name = inv?.name || pItem?.name || "Unknown Item";
              
              // STRICT RULE: Use base units ONLY
              // For recipes, `r.baseQuantity` stores the required amount in base units.
              // `r.baseUnit` stores the base unit string (g, ml, pcs).
              const qtyDisplay = formatBaseQuantity(r.baseQuantity, r.baseUnit);

              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border bg-card"
                >
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-muted-foreground">
                      {qtyDisplay}
                    </div>
                  </div>
                  <RemoveRecipeItemButton id={r.id} action={removeRecipeItem} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
