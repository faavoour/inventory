import { db } from "@/lib/db";
import {
  inventoryItems,
  inventoryMovements,
} from "@/db/schema/inventory";
import { auditLogs } from "@/db/schema/auditLogs";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import AdjustForm from "./AdjustForm";
import { getUnitMultiplier, getBaseUnit, getUnitDefinition } from "@/lib/units";
import { formatBaseQuantity } from "@/lib/baseUnitDisplay";

type ActionState = { error?: string };

async function adjustInventory(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id") || "");
  const type = String(formData.get("type") || "");
  const qtyStr = String(formData.get("quantity") || "").trim();
  const unit = String(formData.get("unit") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  const qty = Number(qtyStr);

  if (!id) return { error: "Invalid item id." };
  if (!reason) return { error: "Reason is required." };
  if (Number.isNaN(qty) || qty <= 0) return { error: "Quantity must be > 0." };
  if (!unit) return { error: "Unit is required." };
  if (type !== "add" && type !== "remove")
    return { error: "Invalid adjustment type." };

  try {
    await db.transaction(async (tx) => {
      const currentItem = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, id))
        .limit(1);
      if (currentItem.length === 0) throw new Error("Item not found");

      const item = currentItem[0];
      const currentQty = Number(item.quantity); // Display Quantity
      const currentBaseQty = item.baseQuantity !== null ? Number(item.baseQuantity) : currentQty; // Item Base Quantity

      // Calculate Adjustment in Standard Base Units (e.g. g, ml, pcs)
      const inputUnitMultiplier = getUnitMultiplier(unit);
      const adjustmentStandardBase = qty * inputUnitMultiplier;
      
      const changeStandardBase = type === "add" ? adjustmentStandardBase : -adjustmentStandardBase;

      // Validate Category Compatibility
      const currentBaseUnit = item.baseUnit || item.unit || "pcs";
      const currentDef = getUnitDefinition(currentBaseUnit);
      const adjustDef = getUnitDefinition(unit);

      if (currentDef && adjustDef && currentDef.category !== adjustDef.category) {
        throw new Error(`Cannot adjust ${currentDef.category} item with ${adjustDef.category} unit.`);
      }

      // STRICT RULE: All calculations and updates are in BASE UNITS only.
      // Update quantity (Legacy column, now used as Base)
      const newQty = currentQty + changeStandardBase;
      
      // Update baseQuantity (New Base Column)
      const newBaseQty = currentBaseQty + changeStandardBase;

      if (newQty < 0) throw new Error("Adjustment would make stock negative.");

      // Update Inventory
      await tx
        .update(inventoryItems)
        .set({ quantity: newQty, baseQuantity: newBaseQty })
        .where(eq(inventoryItems.id, id));

      await tx.insert(inventoryMovements).values({
        inventoryItemId: id,
        changeAmount: changeStandardBase, // Store movement in BASE units
        reason,
      });

      await tx.insert(auditLogs).values({
        entityType: "INVENTORY",
        entityId: id,
        action: "UPDATE",
        beforeData: { quantity: currentQty },
        afterData: { 
          quantity: newQty, 
          reason,
          adjustedQty: qty,
          adjustedUnit: unit
        },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Adjustment failed." };
  }

  revalidatePath("/inventory");
  redirect("/inventory");
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const itemRows = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1);
  if (itemRows.length === 0) {
    notFound();
  }
  const item = itemRows[0];
  if (!item.isActive) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Item Inactive</h1>
        <p className="text-muted-foreground mb-4">This item has been deactivated and cannot be adjusted.</p>
        <Link className="text-primary underline hover:text-primary/80" href="/inventory">
          Back to Inventory
        </Link>
      </div>
    );
  }

  const movements = await db
    .select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.inventoryItemId, id))
    .orderBy(desc(inventoryMovements.createdAt));

  // Calculate Display Values for "Current quantity"
  // STRICT RULE: Show Base Units ONLY
  const baseQty = item.baseQuantity !== null ? Number(item.baseQuantity) : Number(item.quantity);
  const baseUnit = item.baseUnit || item.unit || "";
  
  const displayQtyString = formatBaseQuantity(baseQty, baseUnit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Adjust Inventory</h1>
        <Link className="text-primary hover:underline underline-offset-4" href="/inventory">
          Back to Inventory
        </Link>
      </div>

      <div className="space-y-1">
        <div className="text-lg font-medium text-foreground">{item.name}</div>
        <div className="text-muted-foreground">
          Current quantity: <span className="font-mono">{displayQtyString}</span>
        </div>
      </div>

      <AdjustForm 
        action={adjustInventory} 
        itemId={item.id} 
        defaultUnit={item.baseUnit || item.unit}
      />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Movement History</h2>
        {movements.length === 0 ? (
          <div className="text-muted-foreground">No movements yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-2 border-b border-border text-muted-foreground">Date</th>
                  <th className="text-left p-2 border-b border-border text-muted-foreground">Change (Base)</th>
                  <th className="text-left p-2 border-b border-border text-muted-foreground">Reason</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="p-2">
                      {new Date(m.createdAt!).toLocaleString()}
                    </td>
                    <td className="p-2">{Number(m.changeAmount).toFixed(4)}</td>
                    <td className="p-2">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
