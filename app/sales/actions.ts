'use server';

import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import { inventoryMovements, inventoryItems } from "@/db/schema/inventory";
import { prepInventory, prepUsageMovements } from "@/db/schema/prep";
import { auditLogs } from "@/db/schema/auditLogs";
import { eq, and, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionState = { error?: string };

export async function deleteSale(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Invalid sale id." };
  try {
    await db.transaction(async (tx) => {
      const saleRow = await tx.select().from(sales).where(eq(sales.id, id)).limit(1);
      const itemRows = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
      const allocRows = await tx
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "SALE"), eq(paymentAllocations.entityId, id)));
      const beforeSnapshot =
        saleRow.length > 0
          ? {
              id,
              totalAmount: saleRow[0].totalAmount,
              allocations: allocRows.map((a) => ({
                paymentMethodId: a.paymentMethodId,
                amount: Number(a.amount) || 0,
              })),
              items: itemRows.map((i) => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                totalPrice: i.totalPrice,
              })),
            }
          : null;
      const saleMovs = await tx
        .select()
        .from(inventoryMovements)
        .where(and(eq(inventoryMovements.saleId, id), eq(inventoryMovements.type, "SALE")));
      if (saleMovs.length > 0) {
        const addBackByInv = new Map<string, number>();
        for (const m of saleMovs) {
          const qty = Math.abs(m.changeAmount || 0);
          addBackByInv.set(m.inventoryItemId, (addBackByInv.get(m.inventoryItemId) ?? 0) + qty);
        }
        const invIds = [...addBackByInv.keys()];
        if (invIds.length > 0) {
          const invRows = await tx.select().from(inventoryItems).where(inArray(inventoryItems.id, invIds));
          const invMap = new Map(invRows.map((i) => [i.id, i]));
          for (const [iid, qty] of addBackByInv.entries()) {
            const inv = invMap.get(iid);
            if (!inv) continue;
            
            // qty is the movement amount in Display Units (from inventoryMovements).
            // We must convert it to Base Units.
            const multiplier = Number(inv.unitMultiplier) || 1;
            const addBackBase = qty * multiplier;
            
            const currentBaseQty = inv.baseQuantity !== null ? Number(inv.baseQuantity) : (Number(inv.quantity) * multiplier);
            const newBaseQty = currentBaseQty + addBackBase;

            // Update display quantity
            // Display = Base / Multiplier
            // Derived from NEW Base Quantity (Single Source of Truth)
            const newQty = newBaseQty / multiplier;
            
            await tx.update(inventoryItems).set({ quantity: newQty, baseQuantity: newBaseQty }).where(eq(inventoryItems.id, iid));
          }
        }
        await tx
          .delete(inventoryMovements)
          .where(and(eq(inventoryMovements.saleId, id), eq(inventoryMovements.type, "SALE")));
      }

      // Reverse Prep Usage Movements
      const prepMovs = await tx
        .select()
        .from(prepUsageMovements)
        .where(eq(prepUsageMovements.saleId, id));

      if (prepMovs.length > 0) {
        const addBackByPrep = new Map<string, number>();
        for (const m of prepMovs) {
          const qty = Math.abs(m.changeAmount || 0);
          addBackByPrep.set(m.prepItemId, (addBackByPrep.get(m.prepItemId) ?? 0) + qty);
        }

        for (const [pid, qty] of addBackByPrep.entries()) {
          // Add back to prep inventory
          await tx.update(prepInventory)
            .set({ baseQuantity: sql`${prepInventory.baseQuantity} + ${qty}` })
            .where(eq(prepInventory.prepItemId, pid));
        }

        await tx.delete(prepUsageMovements).where(eq(prepUsageMovements.saleId, id));
      }

      await tx.delete(saleItems).where(eq(saleItems.saleId, id));
      await tx
        .delete(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "SALE"), eq(paymentAllocations.entityId, id)));
      await tx.delete(sales).where(eq(sales.id, id));

      await tx.insert(auditLogs).values({
        entityType: "SALE",
        entityId: id,
        action: "DELETE",
        beforeData: beforeSnapshot,
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
  revalidatePath("/sales");
  revalidatePath("/inventory");
  redirect("/sales?deleted=1");
  return {};
}
