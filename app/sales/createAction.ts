"use server";

import { db } from "@/lib/db";
import { menuItems, recipeItems } from "@/db/schema/menu";
import { sales, saleItems } from "@/db/schema/sales";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { prepItems, prepInventory, prepUsageMovements } from "@/db/schema/prep";
import { auditLogs } from "@/db/schema/auditLogs";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inArray, eq, and, sql } from "drizzle-orm";

export type ActionState = { error?: string; insufficient?: Array<{ name: string; required: number; available: number; unit?: string }> };

export async function createSale(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const saleDateStr = String(formData.get("saleDate") || "").trim();
  const allocMode = String(formData.get("allocMode") || "single");
  const allocA_method = String(formData.get("allocA_method") || "");
  const allocA_amount = Number(String(formData.get("allocA_amount") || "0"));
  const allocB_method = String(formData.get("allocB_method") || "");
  const allocB_amount = Number(String(formData.get("allocB_amount") || "0"));
  const itemIds = formData.getAll("itemId").map((v) => String(v));
  const quantities = formData.getAll("quantity").map((v) => Number(v));

  const pairs = itemIds
    .map((id, idx) => ({ id, qty: quantities[idx] }))
    .filter((p) => p.id && Number.isFinite(p.qty) && p.qty > 0);

  if (pairs.length === 0) {
    return { error: "Add at least one sale item with quantity > 0." };
  }
  if (!saleDateStr) {
    return { error: "Sale Date is required." };
  }

  const ids = [...new Set(pairs.map((p) => p.id))];
  const menu = await db
    .select()
    .from(menuItems)
    .where(inArray(menuItems.id, ids));
  const priceById = new Map(menu.map((m) => [m.id, m.price]));
  const nameById = new Map(menu.map((m) => [m.id, m.name]));
  const pmRows = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true));
  const validPaymentMethods = new Set(pmRows.map((p) => p.id));

  for (const p of pairs) {
    if (!priceById.has(p.id)) {
      return { error: "Invalid menu item selected." };
    }
  }

  const itemsData = pairs.map((p) => {
    const unitPrice = priceById.get(p.id)!;
    const totalPrice = unitPrice * p.qty;
    return {
      menuItemId: p.id,
      quantity: p.qty,
      unitPrice,
      totalPrice,
    };
  });

  const totalAmount = itemsData.reduce((sum, i) => sum + i.totalPrice, 0);

  let allocations: Array<{ paymentMethodId: string; amount: number }> = [];
  if (allocMode === "single") {
    if (!allocA_method) return { error: "Select a payment method." };
    if (!validPaymentMethods.has(allocA_method)) return { error: "Invalid payment method." };
    allocations = [{ paymentMethodId: allocA_method, amount: totalAmount }];
  } else {
    if (!allocA_method || !allocB_method) return { error: "Select both payment methods." };
    if (!validPaymentMethods.has(allocA_method) || !validPaymentMethods.has(allocB_method)) return { error: "Invalid payment method." };
    if (allocA_method === allocB_method) return { error: "Cannot select the same payment method twice." };
    if (!Number.isFinite(allocA_amount) || allocA_amount <= 0 || !Number.isFinite(allocB_amount) || allocB_amount <= 0) {
      return { error: "Amounts must be > 0." };
    }
    if (Math.round((allocA_amount + allocB_amount) * 100) !== Math.round(totalAmount * 100)) {
      return { error: "Amount A + Amount B must equal total." };
    }
    allocations = [
      { paymentMethodId: allocA_method, amount: allocA_amount },
      { paymentMethodId: allocB_method, amount: allocB_amount },
    ];
  }

  if (allocations.some((a) => !a.paymentMethodId)) {
    return { error: "Payment method is required for all allocations." };
  }

  try {
    const recipeRows = await db.select().from(recipeItems).where(inArray(recipeItems.menuItemId, ids));
    // Map of menu item ID -> List of ingredients
    const recipesByMenu = new Map<string, Array<{ 
      inventoryItemId: string | null; 
      prepItemId: string | null;
      quantityRequired: number; 
      baseQuantity: number | null; 
      unit: string; 
      baseUnit: string | null 
    }>>();
    const allInventoryItemIds = new Set<string>();
    const allPrepItemIds = new Set<string>();
    
    for (const r of recipeRows) {
      const list = recipesByMenu.get(r.menuItemId) ?? [];
      list.push({ 
        inventoryItemId: r.inventoryItemId, 
        prepItemId: r.prepItemId,
        quantityRequired: r.quantityRequired, 
        baseQuantity: r.baseQuantity,
        unit: r.unit || "pcs",
        baseUnit: r.baseUnit 
      });
      recipesByMenu.set(r.menuItemId, list);
      if (r.inventoryItemId) allInventoryItemIds.add(r.inventoryItemId);
      if (r.prepItemId) allPrepItemIds.add(r.prepItemId);
    }

    // Fetch inventory items upfront to handle unit conversions
    const invIds = [...allInventoryItemIds];
    const invMap = new Map<string, { id: string; name: string; unit: string; baseUnit: string; unitMultiplier: number; quantity: number; baseQuantity: number | null }>();
    
    if (invIds.length > 0) {
      const invRows = await db.select().from(inventoryItems).where(inArray(inventoryItems.id, invIds));
      for (const row of invRows) {
        invMap.set(row.id, {
          id: row.id,
          name: row.name,
          unit: row.unit,
          baseUnit: row.baseUnit || "pcs", // Ensure this exists in schema
          unitMultiplier: Number(row.unitMultiplier) || 1,
          quantity: Number(row.quantity),
          baseQuantity: row.baseQuantity ? Number(row.baseQuantity) : null,
        });
      }
    }

    // Fetch prep items
    const prepIds = [...allPrepItemIds];
    const prepMap = new Map<string, { id: string; name: string; baseQuantity: number; baseUnit: string }>();
    if (prepIds.length > 0) {
      const prepRows = await db
        .select({
          id: prepItems.id,
          name: prepItems.name,
          baseUnit: prepItems.baseUnit,
          stockBaseQty: prepInventory.baseQuantity,
        })
        .from(prepItems)
        .leftJoin(prepInventory, eq(prepInventory.prepItemId, prepItems.id))
        .where(inArray(prepItems.id, prepIds));
      
      for (const row of prepRows) {
        prepMap.set(row.id, {
          id: row.id,
          name: row.name,
          baseUnit: row.baseUnit,
          baseQuantity: Number(row.stockBaseQty || 0),
        });
      }
    }

    const totalDeductionByInv = new Map<string, number>();
    const movementRows: Array<{ inventoryItemId: string; changeAmount: number; reason: string; type: "SALE" | "SALE_REVERSAL" | "ADJUSTMENT" }> = [];
    
    const totalDeductionByPrep = new Map<string, number>();
    const prepMovementRows: Array<{ prepItemId: string; changeAmount: number; reason: string }> = [];

    for (const p of pairs) {
      const ritems = recipesByMenu.get(p.id) ?? [];
      for (const r of ritems) {
        if (r.inventoryItemId) {
          const inv = invMap.get(r.inventoryItemId);
          if (!inv) continue; // Should not happen if data integrity is good

          // 1. Calculate Required Quantity in Standard Base Units (e.g., grams)
          // Use baseQuantity if available (standardized unit), otherwise fallback to quantityRequired (legacy behavior)
          const qtyPerItemBase = r.baseQuantity ?? r.quantityRequired;
          const reqBase = qtyPerItemBase * p.qty;

          // 2. Deduction in Base Units (NO CONVERSION)
          // The recipe.baseQuantity is already in the inventory item's base unit.
          // e.g. If Inv is 'kg' (base 'g'), reqBase is 500 (g).
          
          const deductionBase = reqBase; // Base Units (g, ml, pcs)
          const deductionDisplay = reqBase / inv.unitMultiplier; // Display Units (kg, L) - ONLY for display quantity update

          totalDeductionByInv.set(r.inventoryItemId, (totalDeductionByInv.get(r.inventoryItemId) ?? 0) + deductionBase);
          
          movementRows.push({
            inventoryItemId: r.inventoryItemId,
            changeAmount: -deductionBase, // Store in Base Units (e.g. -500 for 500g)
            reason: `Sale: ${nameById.get(p.id) ?? ""}`,
            type: "SALE",
          });
        } else if (r.prepItemId) {
          const prep = prepMap.get(r.prepItemId);
          if (!prep) continue;

          // Prep items are tracked in base units.
          // r.baseQuantity should be populated correctly from recipe insertion.
          const qtyPerItemBase = r.baseQuantity ?? r.quantityRequired;
          const reqBase = qtyPerItemBase * p.qty;

          totalDeductionByPrep.set(r.prepItemId, (totalDeductionByPrep.get(r.prepItemId) ?? 0) + reqBase);
          prepMovementRows.push({
            prepItemId: r.prepItemId,
            changeAmount: -reqBase, // Store in Base Units
            reason: `Sale: ${nameById.get(p.id) ?? ""}`,
            });
        }
      }
    }

    const insufficient: Array<{ name: string; required: number; available: number; unit?: string }> = [];
    
    for (const [iid, deduction] of totalDeductionByInv.entries()) {
      const inv = invMap.get(iid);
      if (!inv) continue;
      
      // Check sufficiency (Quantity in Base Units)
      // inv.quantity is display unit. We need baseQuantity.
      const availableBase = inv.baseQuantity !== null ? inv.baseQuantity : (inv.quantity * inv.unitMultiplier);
      
      if (availableBase < deduction) {
        insufficient.push({
          name: inv.name,
          required: deduction,
          available: availableBase,
          unit: inv.baseUnit, // Show base unit in error
        });
      }
    }

    for (const [pid, deduction] of totalDeductionByPrep.entries()) {
      const prep = prepMap.get(pid);
      if (!prep) continue;
      
      // Check sufficiency (Quantity in Base Units)
      if (prep.baseQuantity < deduction) {
        insufficient.push({
          name: prep.name,
          required: deduction,
          available: prep.baseQuantity,
          unit: prep.baseUnit,
        });
      }
    }

    if (insufficient.length > 0) {
      return { error: "Insufficient stock", insufficient };
    }

    await db.transaction(async (tx) => {
      // Use current server time for accurate timestamps
      const now = new Date();

      // Deduct Inventory Items
      for (const [iid, deductionBaseTotal] of totalDeductionByInv.entries()) {
        const inv = invMap.get(iid)!;
        
        // deductionBaseTotal is in Base Units (e.g. 500g)
        // We need to convert it to Display Units for the quantity column
        const deductionDisplay = deductionBaseTotal / inv.unitMultiplier;
        
        // Update both quantity and baseQuantity.
        const currentBaseQty = inv.baseQuantity !== null ? inv.baseQuantity : (inv.quantity * inv.unitMultiplier);
        const newBaseQty = currentBaseQty - deductionBaseTotal;
        
        // STRICT RULE: Derived display quantity from Base Quantity
        // Do NOT subtract display quantities directly to avoid drift.
        // newQty = newBaseQty / multiplier
        const newQty = newBaseQty / inv.unitMultiplier;
        
        await tx.update(inventoryItems).set({ quantity: newQty, baseQuantity: newBaseQty }).where(eq(inventoryItems.id, iid));
      }

      // Deduct Prep Items
      for (const [pid, deduction] of totalDeductionByPrep.entries()) {
        // Use sql increment for atomicity or just set logic if we trust sufficiency check
        // Using sql to subtract
        await tx.update(prepInventory)
          .set({ baseQuantity: sql`${prepInventory.baseQuantity} - ${deduction}` })
          .where(eq(prepInventory.prepItemId, pid));
      }

      const inserted = await tx.insert(sales).values({ 
        totalAmount, 
        paymentMethodId: null, 
        saleDate: saleDateStr,
        createdAt: now 
      }).returning({ id: sales.id });
      const saleId = inserted[0].id;
      
      if (movementRows.length > 0) {
        await tx.insert(inventoryMovements).values(movementRows.map((m) => ({ ...m, saleId, createdAt: now })));
      }

      if (prepMovementRows.length > 0) {
        await tx.insert(prepUsageMovements).values(prepMovementRows.map((m) => ({ ...m, saleId, createdAt: now })));
      }
      
      await tx.insert(saleItems).values(itemsData.map((i) => ({ ...i, saleId })));
      
      await tx.delete(paymentAllocations).where(and(eq(paymentAllocations.entityType, "SALE"), eq(paymentAllocations.entityId, saleId)));
      await tx.insert(paymentAllocations).values(
        allocations.map((a) => ({
          entityType: "SALE" as const,
          entityId: saleId,
          paymentMethodId: a.paymentMethodId,
          amount: a.amount,
        }))
      );
      
      await tx.insert(auditLogs).values({
        entityType: "SALE",
        entityId: saleId,
        action: "CREATE",
        afterData: {
          id: saleId,
          totalAmount,
          saleDate: saleDateStr,
          allocations: allocations.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: a.amount })),
          items: itemsData,
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }

  try {
    revalidatePath("/sales");
  } catch (error) {
    // Ignore revalidatePath error in non-Next.js context
  }
  redirect("/sales");
}
