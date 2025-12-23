import { db } from "@/lib/db";
import { inventoryItems } from "@/db/schema/inventory";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import InventoryForm from "./InventoryForm";
import { convertToBase, getUnitMultiplier, getBaseUnit } from "@/lib/units";

type ActionState = { error?: string };

async function createInventoryItem(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  const quantityStr = String(formData.get("quantity") || "").trim();
  const totalCostStr = String(formData.get("totalPurchaseCost") || "").trim();

  const quantity = Number(quantityStr);
  const totalPurchaseCost = Number(totalCostStr);
  const type = String(formData.get("type") || "RAW");

  if (!name || !unit) {
    return { error: "Name and Unit are required." };
  }
  if (Number.isNaN(quantity) || quantity <= 0) {
    return { error: "Quantity must be greater than 0." };
  }
  if (Number.isNaN(totalPurchaseCost) || totalPurchaseCost <= 0) {
    return { error: "Total Purchase Cost must be a positive number." };
  }

  // Calculate Base Values
  const unitMultiplier = getUnitMultiplier(unit);
  const baseUnitVal = getBaseUnit(unit);
  
  if (!baseUnitVal) {
    return { error: "Invalid unit selected." };
  }

  const baseQuantity = quantity * unitMultiplier;
  const costPerBaseUnit = Number((totalPurchaseCost / baseQuantity).toFixed(4));
  
  // Store values
  // quantity & costPerUnit -> Base Units (as per strict rules)
  // unit -> Base Unit (to keep quantity+unit semantic)
  // displayUnit -> Original input unit (Preference, but ignored for display now)
  
  await db.insert(inventoryItems).values({
    name,
    unit: baseUnitVal, // Storing base unit here e.g. "g"
    quantity: baseQuantity, // Storing base quantity e.g. 1000
    costPerUnit: costPerBaseUnit, // Cost per base unit
    
    // Standardized fields
    baseQuantity,
    baseUnit: baseUnitVal,
    costPerBaseUnit,
    
    // Display preferences (Stored but not used for display anymore)
    displayUnit: unit, // e.g. "kg"
    unitMultiplier, // e.g. 1000
    type,
  });

  revalidatePath("/inventory");
  redirect(`/inventory?type=${type}`);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  const type = (params?.type as "RAW" | "PACKAGING") || "RAW";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New {type === "PACKAGING" ? "Packaging" : "Inventory"} Item</h1>
        <Link className="text-primary underline hover:text-primary/80" href={`/inventory?type=${type}`}>
          Back to {type === "PACKAGING" ? "Packaging" : "Inventory"}
        </Link>
      </div>

      <InventoryForm action={createInventoryItem} type={type} />
    </div>
  );
}
