import { db } from "@/lib/db";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { auditLogs } from "@/db/schema/auditLogs";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import RestockForm from "./RestockForm";
import { suppliers } from "@/db/schema/suppliers";

type ActionState = { error?: string };

async function restockInventory(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id") || "");
  const qtyStr = String(formData.get("quantity") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const totalStr = String(formData.get("totalPrice") || "").trim();
  const supplierId = String(formData.get("supplierId") || "").trim();

  const qty = Number(qtyStr);
  const total = Number(totalStr);
  if (!id) return { error: "Invalid item id." };
  if (qtyStr.startsWith("0") && qtyStr.length > 1 && qtyStr[1] !== ".") return { error: "Quantity must not start with a leading zero." };
  if (Number.isNaN(qty) || qty <= 0) return { error: "Quantity must be > 0." };
  if (Number.isNaN(total) || total <= 0) return { error: "Total purchase price must be > 0." };

  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, id))
        .limit(1);
      if (rows.length === 0) throw new Error("Item not found");
      const item = rows[0];

      if (!item.isActive) throw new Error("Cannot restock inactive item.");
      
      // STRICT RULE: Use Base Unit from DB only
      const restockBaseUnit = item.baseUnit || item.unit;
      const restockBaseQty = qty; // Input is already in base units
      
      if (!restockBaseUnit) throw new Error("Item has no base unit defined.");

      // Determine Current Base Quantity & Cost
      const currentStoredQty = item.baseQuantity !== null ? Number(item.baseQuantity) : Number(item.quantity);
      const currentCostPerStoredUnit = item.costPerBaseUnit !== null ? Number(item.costPerBaseUnit) : Number(item.costPerUnit);

      // New Totals (Weighted Average)
      // Value = (CurrentStoredQty * CurrentCostPerStoredUnit) + TotalPurchasePrice
      const currentValue = currentStoredQty * currentCostPerStoredUnit;
      const newValue = currentValue + total;
      
      // Calculate New Quantity
      const newBaseQty = currentStoredQty + restockBaseQty;
      
      const newCostPerBase = newBaseQty > 0 ? newValue / newBaseQty : 0;

      // Update Inventory
      await tx
        .update(inventoryItems)
        .set({ 
          quantity: newBaseQty, 
          unit: restockBaseUnit,
          costPerUnit: newCostPerBase, 
          
          baseQuantity: newBaseQty,
          baseUnit: restockBaseUnit,
          costPerBaseUnit: newCostPerBase,
          
          displayUnit: restockBaseUnit, // Enforce base unit display
          unitMultiplier: 1 // Reset multiplier as we are in base units
        })
        .where(eq(inventoryItems.id, id));

      // Log Movement
      await tx.insert(inventoryMovements).values({
        inventoryItemId: id,
        changeAmount: restockBaseQty, 
        type: "ADJUSTMENT", 
        reason: note || "Restock",
        supplierId: supplierId || null,
      });

      await tx.insert(auditLogs).values({
        entityType: "INVENTORY",
        entityId: id,
        action: "RESTOCK",
        afterData: {
          addedQty: qty,
          addedUnit: restockBaseUnit,
          totalPrice: total,
          newBaseQty,
          newCostPerBase
        }
      });
    });
  } catch (err: any) {
    return { error: err.message || "Failed to restock." };
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  redirect("/inventory");
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1);
    
  if (rows.length === 0) {
    notFound();
  }
  
  const item = rows[0];
  if (!item.isActive) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Item Inactive</h1>
        <p className="text-muted-foreground mb-4">This item has been deactivated and cannot be restocked.</p>
        <Link className="text-primary underline hover:text-primary/80" href="/inventory">
          Back to Inventory
        </Link>
      </div>
    );
  }
  
  // Fetch suppliers for the dropdown
  const supplierList = await db.select().from(suppliers);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Restock: {item.name}</h1>
        <Link className="text-primary underline hover:text-primary/80" href="/inventory">
          Cancel
        </Link>
      </div>

      <RestockForm 
        action={restockInventory} 
        itemId={id} 
        suppliers={supplierList}
        baseUnit={item.baseUnit || item.unit} 
      />
    </div>
  );
}
