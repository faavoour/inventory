import { db } from "@/lib/db";
import { inventoryItems } from "@/db/schema/inventory";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import EditInventoryForm from "./EditInventoryForm";
import { getUnitMultiplier, getBaseUnit, getUnitDefinition } from "@/lib/units";

type ActionState = { error?: string };

async function updateInventoryItem(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  const costPerUnitStr = String(formData.get("costPerUnit") || "").trim();
  const costPerUnitNum = Number(costPerUnitStr);

  if (!id) return { error: "Invalid item id." };
  if (!name || !unit) return { error: "Name and Unit are required." };
  if (Number.isNaN(costPerUnitNum) || costPerUnitNum < 0) return { error: "Cost per Unit must be a valid number." };
  
  // Fetch current item to check category compatibility
  const currentItems = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
  if (currentItems.length === 0) return { error: "Item not found." };
  const currentItem = currentItems[0];

  const currentBaseUnit = currentItem.baseUnit || currentItem.unit;
  const currentDef = getUnitDefinition(currentBaseUnit);
  const newDef = getUnitDefinition(unit);

  if (currentDef && newDef && currentDef.category !== newDef.category) {
    return { error: `Cannot change category from ${currentDef.category} to ${newDef.category}.` };
  }

  // Calculate new values
  const unitMultiplier = getUnitMultiplier(unit);
  const baseUnit = getBaseUnit(unit);
  
  let newQuantity = Number(currentItem.quantity);
  let newCostPerUnit = Number(currentItem.costPerUnit);
  // Handle potentially null base values by falling back to legacy columns
  let newBaseQuantity = currentItem.baseQuantity !== null ? Number(currentItem.baseQuantity) : Number(currentItem.quantity);
  let newCostPerBaseUnit = currentItem.costPerBaseUnit !== null ? Number(currentItem.costPerBaseUnit) : Number(currentItem.costPerUnit);

  const currentStoredUnit = currentItem.baseUnit || currentItem.unit;

  // If the item's stored base unit is different from the new standard base unit,
  // we must convert the stored values (Migration of legacy items).
  if (baseUnit && currentStoredUnit && currentStoredUnit !== baseUnit) {
      // We rely on getUnitMultiplier to tell us how many standard base units are in the current stored unit
      const conversion = getUnitMultiplier(currentStoredUnit);
      
      // e.g. 'kg' -> 1000. So we convert 0.5 kg -> 500 g.
      newQuantity = newQuantity * conversion;
      newCostPerUnit = newCostPerUnit / conversion;
      newBaseQuantity = newBaseQuantity * conversion;
      newCostPerBaseUnit = newCostPerBaseUnit / conversion;
  }
  
  // Update:
  // name
  // unit -> baseUnit (strict)
  // displayUnit -> unit (entered)
  // unitMultiplier -> unitMultiplier
  // costPerUnit -> Updated if re-based
  // baseQuantity -> Updated if re-based

  await db
    .update(inventoryItems)
    .set({
      name,
      unit: baseUnit || unit, // Enforce base unit storage
      displayUnit: unit,      // Store preference
      unitMultiplier,
      quantity: newQuantity,
      costPerUnit: newCostPerUnit,
      baseQuantity: newBaseQuantity,
      baseUnit: baseUnit || unit,
      costPerBaseUnit: newCostPerBaseUnit,
    })
    .where(eq(inventoryItems.id, id));

  revalidatePath("/inventory");
  redirect("/inventory");
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1);

  if (item.length === 0) {
    notFound();
  }

  const current = item[0];
  
  // Use Base Unit Values Only
  const baseQty = current.baseQuantity !== null ? Number(current.baseQuantity) : Number(current.quantity);
  const baseCost = current.costPerBaseUnit !== null ? Number(current.costPerBaseUnit) : Number(current.costPerUnit);
  const baseUnit = current.baseUnit || current.unit;

  const displayData = {
    id: current.id,
    name: current.name,
    unit: baseUnit,
    quantity: baseQty,
    costPerUnit: baseCost,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Inventory Item</h1>
        <Link className="text-primary underline hover:text-primary/80" href="/inventory">
          Back to Inventory
        </Link>
      </div>
      <EditInventoryForm current={displayData} action={updateInventoryItem} />
    </div>
  );
}
