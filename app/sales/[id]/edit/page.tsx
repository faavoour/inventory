import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { menuItems, recipeItems } from "@/db/schema/menu";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { prepInventory, prepItems, prepUsageMovements } from "@/db/schema/prep";
import { auditLogs } from "@/db/schema/auditLogs";
import { eq, inArray, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditSaleForm from "./EditSaleForm";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import { getUnitMultiplier } from "@/lib/units";

type ActionState = { error?: string; insufficient?: Array<{ name: string; required: number; available: number; unit?: string }> };

async function updateSale(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id") || "");
  const saleDateStr = String(formData.get("saleDate") || "").trim();
  const allocMode = String(formData.get("allocMode") || "single");
  const allocA_method = String(formData.get("allocA_method") || "");
  const allocA_amount = Number(String(formData.get("allocA_amount") || "0"));
  const allocB_method = String(formData.get("allocB_method") || "");
  const allocB_amount = Number(String(formData.get("allocB_amount") || "0"));
  if (!id) return { error: "Invalid sale id." };
  if (!saleDateStr) return { error: "Sale Date is required." };

  const itemIds = formData.getAll("itemId").map((v) => String(v));
  const quantities = formData.getAll("quantity").map((v) => Number(v));
  const pairs = itemIds
    .map((mid, idx) => ({ mid, qty: quantities[idx] }))
    .filter((p) => p.mid && Number.isFinite(p.qty) && p.qty > 0);
  if (pairs.length === 0) {
    return { error: "Add at least one sale item with quantity > 0." };
  }

  const pmRows = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true));
  const validPaymentMethods = new Set(pmRows.map((p) => p.id));

  const ids = [...new Set(pairs.map((p) => p.mid))];
  const menu = await db.select().from(menuItems).where(inArray(menuItems.id, ids));
  const priceById = new Map(menu.map((m) => [m.id, m.price]));
  const nameById = new Map(menu.map((m) => [m.id, m.name]));
  for (const p of pairs) {
    if (!priceById.has(p.mid)) {
      return { error: "Invalid menu item selected." };
    }
  }
  const newItemsData = pairs.map((p) => {
    const unitPrice = priceById.get(p.mid)!;
    const totalPrice = unitPrice * p.qty;
    return {
      menuItemId: p.mid,
      quantity: p.qty,
      unitPrice,
      totalPrice,
    };
  });
  const newTotalAmount = newItemsData.reduce((sum, i) => sum + i.totalPrice, 0);

  let allocations: Array<{ paymentMethodId: string; amount: number }> = [];
  if (allocMode === "single") {
    if (!allocA_method) return { error: "Select a payment method." };
    if (!validPaymentMethods.has(allocA_method)) return { error: "Invalid payment method." };
    allocations = [{ paymentMethodId: allocA_method, amount: newTotalAmount }];
  } else {
    if (!allocA_method || !allocB_method) return { error: "Select both payment methods." };
    if (!validPaymentMethods.has(allocA_method) || !validPaymentMethods.has(allocB_method)) return { error: "Invalid payment method." };
    if (allocA_method === allocB_method) return { error: "Cannot select the same payment method twice." };
    if (!Number.isFinite(allocA_amount) || allocA_amount <= 0 || !Number.isFinite(allocB_amount) || allocB_amount <= 0) {
      return { error: "Amounts must be > 0." };
    }
    if (Math.round((allocA_amount + allocB_amount) * 100) !== Math.round(newTotalAmount * 100)) {
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
    let insufficient: Array<{ name: string; required: number; available: number; unit?: string }> = [];
    await db.transaction(async (tx) => {
      const existingSaleRows = await tx.select().from(sales).where(eq(sales.id, id)).limit(1);
      const existingMovements = await tx
        .select()
        .from(inventoryMovements)
        .where(eq(inventoryMovements.saleId, id));
      const existingPrepMovements = await tx
        .select()
        .from(prepUsageMovements)
        .where(eq(prepUsageMovements.saleId, id));
      const existingItems = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
      const existingAllocs = await tx.select().from(paymentAllocations).where(and(eq(paymentAllocations.entityType, "SALE"), eq(paymentAllocations.entityId, id)));
      const beforeSnapshot =
        existingSaleRows.length > 0
          ? {
              id,
              totalAmount: existingSaleRows[0].totalAmount,
              allocations: existingAllocs.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: Number(a.amount) || 0 })),
              items: existingItems.map((i) => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                totalPrice: i.totalPrice,
              })),
            }
          : null;
      
      // 1. REVERSE EXISTING MOVEMENTS
      if (existingMovements.length > 0) {
        const addBackByInv = new Map<string, number>();
        for (const m of existingMovements) {
          if ((m.type as unknown as string) === "SALE" || m.type === null) {
            const qty = Math.abs(m.changeAmount || 0);
            addBackByInv.set(m.inventoryItemId, (addBackByInv.get(m.inventoryItemId) ?? 0) + qty);
          }
        }
        const invIds = [...addBackByInv.keys()];
        if (invIds.length > 0) {
          const invRows = await tx.select().from(inventoryItems).where(inArray(inventoryItems.id, invIds));
          const invMap = new Map(invRows.map((i) => [i.id, i]));
          for (const [iid, qty] of addBackByInv.entries()) {
            const inv = invMap.get(iid);
            if (!inv) continue;
            const multiplier = Number(inv.unitMultiplier) || 1;
            const currentBaseQty = inv.baseQuantity !== null ? Number(inv.baseQuantity) : (Number(inv.quantity) * multiplier);
            
            // qty is Display Unit (from movement)
            const addBackBase = qty * multiplier;
            const newBaseQty = currentBaseQty + addBackBase;
            
            // Derive display qty from base
            const newQty = newBaseQty / multiplier;

            await tx.update(inventoryItems).set({ quantity: newQty, baseQuantity: newBaseQty }).where(eq(inventoryItems.id, iid));
          }
        }
        await tx
          .delete(inventoryMovements)
          .where(eq(inventoryMovements.saleId, id));
      }

      if (existingPrepMovements.length > 0) {
        const addBackByPrep = new Map<string, number>();
        for (const m of existingPrepMovements) {
            const qty = Math.abs(m.changeAmount || 0);
            addBackByPrep.set(m.prepItemId, (addBackByPrep.get(m.prepItemId) ?? 0) + qty);
        }
        const prepIds = [...addBackByPrep.keys()];
        if (prepIds.length > 0) {
            const prepRows = await tx.select().from(prepInventory).where(inArray(prepInventory.prepItemId, prepIds));
            const prepMap = new Map(prepRows.map((p) => [p.prepItemId, p]));
            for (const [pid, qty] of addBackByPrep.entries()) {
                const pInv = prepMap.get(pid);
                if (!pInv) continue;
                const newBase = (pInv.baseQuantity || 0) + qty;
                await tx.update(prepInventory).set({ baseQuantity: newBase }).where(eq(prepInventory.prepItemId, pid));
            }
        }
        await tx.delete(prepUsageMovements).where(eq(prepUsageMovements.saleId, id));
      }

      // 2. CALCULATE NEW DEDUCTIONS
      const recipesRows = ids.length
        ? await tx.select().from(recipeItems).where(inArray(recipeItems.menuItemId, ids))
        : [];
      const recipesByMenuNew = new Map<string, Array<{ inventoryItemId: string | null; prepItemId: string | null; sourceType: "RAW" | "PACKAGING" | "PREP"; quantityRequired: number; baseQuantity: number | null }>>();
      const allInventoryItemIds = new Set<string>();
      const allPrepItemIds = new Set<string>();
      
      for (const r of recipesRows) {
        const sourceType = r.sourceType ?? "RAW";
        if (sourceType === "PREP") {
            if (!r.prepItemId) continue;
            const list = recipesByMenuNew.get(r.menuItemId) ?? [];
            list.push({ inventoryItemId: null, prepItemId: r.prepItemId, sourceType: "PREP", quantityRequired: r.quantityRequired, baseQuantity: r.baseQuantity });
            recipesByMenuNew.set(r.menuItemId, list);
            allPrepItemIds.add(r.prepItemId);
        } else {
            if (!r.inventoryItemId) continue;
            const list = recipesByMenuNew.get(r.menuItemId) ?? [];
            list.push({ inventoryItemId: r.inventoryItemId, prepItemId: null, sourceType: sourceType as "RAW" | "PACKAGING", quantityRequired: r.quantityRequired, baseQuantity: r.baseQuantity });
            recipesByMenuNew.set(r.menuItemId, list);
            allInventoryItemIds.add(r.inventoryItemId);
        }
      }
      
      // Fetch inventory items upfront
      const invIds = [...allInventoryItemIds];
      const invMap = new Map<string, { id: string; name: string; unit: string; baseUnit: string; unitMultiplier: number; quantity: number; baseQuantity: number | null }>();
      
      if (invIds.length > 0) {
        const invRows = await tx.select().from(inventoryItems).where(inArray(inventoryItems.id, invIds));
        for (const row of invRows) {
          invMap.set(row.id, {
            id: row.id,
            name: row.name,
            unit: row.unit,
            baseUnit: row.baseUnit || "pcs",
            unitMultiplier: Number(row.unitMultiplier) || 1,
            quantity: Number(row.quantity),
            baseQuantity: row.baseQuantity ? Number(row.baseQuantity) : null,
          });
        }
      }

      // Fetch Prep Items
      const prepIds = [...allPrepItemIds];
      const prepMap = new Map<string, { prepItemId: string; name: string; baseUnit: string; baseQuantity: number }>();
      
      if (prepIds.length > 0) {
         const pRows = await tx
            .select({
                prepItemId: prepInventory.prepItemId,
                baseQuantity: prepInventory.baseQuantity,
                name: prepItems.name,
                baseUnit: prepItems.baseUnit
            })
            .from(prepInventory)
            .innerJoin(prepItems, eq(prepInventory.prepItemId, prepItems.id))
            .where(inArray(prepInventory.prepItemId, prepIds));
            
         for (const row of pRows) {
            prepMap.set(row.prepItemId, {
                prepItemId: row.prepItemId,
                name: row.name,
                baseUnit: row.baseUnit,
                baseQuantity: row.baseQuantity || 0
            });
         }
      }

      const totalDeductionByInv = new Map<string, number>();
      const totalDeductionByPrep = new Map<string, number>();
      
      const deductionMovements: Array<{ inventoryItemId: string; changeAmount: number; reason: string; type: "SALE" | "SALE_REVERSAL" | "ADJUSTMENT"; saleId: string }> = [];
      const prepDeductionMovements: Array<{ prepItemId: string; changeAmount: number; reason: string; saleId: string }> = [];
      
      for (const p of pairs) {
        const rs = recipesByMenuNew.get(p.mid) ?? [];
        for (const r of rs) {
            if (r.sourceType === "PREP") {
                const pInv = prepMap.get(r.prepItemId!);
                if (!pInv) continue;
                const deduction = (r.baseQuantity ?? 0) * p.qty;
                totalDeductionByPrep.set(r.prepItemId!, (totalDeductionByPrep.get(r.prepItemId!) ?? 0) + deduction);
                
                prepDeductionMovements.push({
                    prepItemId: r.prepItemId!,
                    changeAmount: -deduction,
                    reason: "Sale edit",
                    saleId: id
                });
            } else {
                const inv = invMap.get(r.inventoryItemId!);
                if (!inv) continue;
                const qtyPerItemBase = r.baseQuantity ?? r.quantityRequired;
                const reqBase = qtyPerItemBase * p.qty;
                const deduction = reqBase / inv.unitMultiplier;
                totalDeductionByInv.set(r.inventoryItemId!, (totalDeductionByInv.get(r.inventoryItemId!) ?? 0) + deduction);
                deductionMovements.push({
                    inventoryItemId: r.inventoryItemId!,
                    changeAmount: -deduction,
                    reason: "Sale edit",
                    type: "SALE",
                    saleId: id,
                });
            }
        }
      }

      // Check Insufficient
      const list: Array<{ name: string; required: number; available: number; unit?: string }> = [];

      if (totalDeductionByInv.size > 0) {
        for (const [iid, deduction] of totalDeductionByInv.entries()) {
          const inv = invMap.get(iid);
          if (!inv) continue;
          if (inv.quantity < deduction) {
            list.push({
              name: inv.name,
              required: deduction,
              available: inv.quantity,
              unit: inv.unit,
            });
          }
        }
      }

      if (totalDeductionByPrep.size > 0) {
        for (const [pid, deduction] of totalDeductionByPrep.entries()) {
            const pInv = prepMap.get(pid);
            if (!pInv) continue;
            // Check base quantity directly
            if (pInv.baseQuantity < deduction) {
                list.push({
                    name: pInv.name,
                    required: deduction,
                    available: pInv.baseQuantity,
                    unit: pInv.baseUnit
                });
            }
        }
      }
        
      if (list.length > 0) {
        insufficient = list;
        return; 
      }

      const [y, m, d] = saleDateStr.split("-").map((v) => Number(v));
      const saleCreatedAt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
        
      // Update Inventory
      for (const [iid, deduction] of totalDeductionByInv.entries()) {
          const inv = invMap.get(iid)!;
          const multiplier = inv.unitMultiplier;
          const currentBaseQty = inv.baseQuantity !== null ? inv.baseQuantity : (inv.quantity * multiplier);
          const deductionBase = deduction * multiplier;
          const newBaseQty = currentBaseQty - deductionBase;
          const newQty = newBaseQty / multiplier;
          await tx.update(inventoryItems).set({ quantity: newQty, baseQuantity: newBaseQty }).where(eq(inventoryItems.id, iid));
      }
        
      if (deductionMovements.length > 0) {
          await tx.insert(inventoryMovements).values(deductionMovements.map((m) => ({ ...m, createdAt: saleCreatedAt })));
      }

      // Update Prep
      for (const [pid, deduction] of totalDeductionByPrep.entries()) {
          const pInv = prepMap.get(pid)!;
          const newBaseQty = pInv.baseQuantity - deduction;
          await tx.update(prepInventory).set({ baseQuantity: newBaseQty }).where(eq(prepInventory.prepItemId, pid));
      }

      if (prepDeductionMovements.length > 0) {
          await tx.insert(prepUsageMovements).values(prepDeductionMovements.map(m => ({ ...m, createdAt: saleCreatedAt })));
      }

      await tx.update(sales).set({ totalAmount: newTotalAmount, paymentMethodId: null, saleDate: saleDateStr }).where(eq(sales.id, id));
      await tx.delete(saleItems).where(eq(saleItems.saleId, id));
      await tx.insert(saleItems).values(
        newItemsData.map((i) => ({
          ...i,
          saleId: id,
        }))
      );
      await tx.delete(paymentAllocations).where(and(eq(paymentAllocations.entityType, "SALE"), eq(paymentAllocations.entityId, id)));
      await tx.insert(paymentAllocations).values(
        allocations.map((a) => ({
          entityType: "SALE" as const,
          entityId: id,
          paymentMethodId: a.paymentMethodId,
          amount: a.amount,
        }))
      );

      await tx.insert(auditLogs).values({
        entityType: "SALE",
        entityId: id,
        action: "UPDATE",
        beforeData: beforeSnapshot,
        afterData: {
          id,
          totalAmount: newTotalAmount,
          saleDate: saleDateStr,
          allocations: allocations.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: a.amount })),
          items: newItemsData,
        },
      });
    });
    if (insufficient.length > 0) {
      return { error: "Insufficient stock to apply edited sale.", insufficient };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/sales");
  revalidatePath("/inventory");
  redirect(`/sales?updated=1`);
  return {};
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const saleRows = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  if (saleRows.length === 0) {
    notFound();
  }
  const sale = saleRows[0];

  const items = await db
    .select({
      id: saleItems.id,
      menuItemId: saleItems.menuItemId,
      quantity: saleItems.quantity,
    })
    .from(saleItems)
    .where(eq(saleItems.saleId, id));

  const menu = await db.select().from(menuItems).orderBy(menuItems.name);
  const methods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.isActive, true))
    .orderBy(paymentMethods.name);
  const allocations = await db
    .select()
    .from(paymentAllocations)
    .where(and(eq(paymentAllocations.entityType, "SALE"), eq(paymentAllocations.entityId, id)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Sale</h1>
        <Link className="underline" href={`/sales/${id}`}>
          Back to Sale
        </Link>
      </div>
      <div className="border border-warning/20 bg-warning/15 text-warning p-3 rounded">
        Editing this sale will recalculate inventory, COGS, and financial reports. Use this only to correct mistakes.
      </div>
      <EditSaleForm
        action={updateSale}
        saleId={sale.id}
        saleDate={String(sale.saleDate)}
        allocations={allocations.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: Number(a.amount) || 0 }))}
        items={items.map((i) => ({ itemId: i.menuItemId, quantity: i.quantity }))}
        menuItems={menu.map((m) => ({ id: m.id, name: m.name, price: m.price }))}
        paymentMethods={methods.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
