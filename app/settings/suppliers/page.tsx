import { db } from "@/lib/db";
import { suppliers } from "@/db/schema/suppliers";
import Link from "next/link";
import { eq, desc, sql, inArray } from "drizzle-orm";
import SupplierForm from "./SupplierForm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLogs } from "@/db/schema/auditLogs";
import SupplierActions from "./SupplierActions";
import { inventoryMovements } from "@/db/schema/inventory";
import { fmtCurrencyNaira } from "@/lib/format";

export const dynamic = "force-dynamic";

type ActionState = { error?: string };

async function createSupplier(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const note = String(formData.get("note") || "").trim();
  if (!name) return { error: "Name is required." };

  const existing = await db.select().from(suppliers).where(eq(suppliers.name, name)).limit(1);
  if (existing.length > 0) {
    return { error: "This supplier already exists." };
  }

  await db.insert(suppliers).values({ name, note });
  revalidatePath("/settings/suppliers");
  redirect("/settings/suppliers");
}

export async function deleteSupplier(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Invalid id." };
  }
  try {
    const usageRows = await db
      .select({ c: sql<number>`count(*)` })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.supplierId, id));
    const usageCount = usageRows[0]?.c ?? 0;
    if (usageCount > 0) {
      await db.transaction(async (tx) => {
        const beforeRows = await tx.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
        if (beforeRows.length === 0) {
          throw new Error("Supplier not found.");
        }
        const before = beforeRows[0];
        await tx.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
        await tx.insert(auditLogs).values({
          entityType: "SUPPLIER",
          entityId: id,
          action: "DEACTIVATE",
          beforeData: { id: before.id, name: before.name, isActive: before.isActive },
          afterData: { id: before.id, name: before.name, isActive: false },
        });
      });
      revalidatePath("/settings/suppliers");
      redirect("/settings/suppliers?deactivated=1");
      return {};
    }
    await db.delete(suppliers).where(eq(suppliers.id, id));
    revalidatePath("/settings/suppliers");
    redirect("/settings/suppliers?deleted=1");
    return {};
  } catch {
    return { error: "Unable to update supplier." };
  }
}

export async function deactivateSupplier(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Invalid id." };
  }
  await db.transaction(async (tx) => {
    const beforeRows = await tx.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (beforeRows.length === 0) {
      throw new Error("Supplier not found.");
    }
    const before = beforeRows[0];
    await tx.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
    await tx.insert(auditLogs).values({
      entityType: "SUPPLIER",
      entityId: id,
      action: "DEACTIVATE",
      beforeData: { id: before.id, name: before.name, isActive: before.isActive },
      afterData: { id: before.id, name: before.name, isActive: false },
    });
  });
  revalidatePath("/settings/suppliers");
  return {};
}

export async function reactivateSupplier(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Invalid id." };
  }
  await db.transaction(async (tx) => {
    const beforeRows = await tx.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (beforeRows.length === 0) {
      throw new Error("Supplier not found.");
    }
    const before = beforeRows[0];
    await tx.update(suppliers).set({ isActive: true }).where(eq(suppliers.id, id));
    await tx.insert(auditLogs).values({
      entityType: "SUPPLIER",
      entityId: id,
      action: "REACTIVATE",
      beforeData: { id: before.id, name: before.name, isActive: before.isActive },
      afterData: { id: before.id, name: before.name, isActive: true },
    });
  });
  revalidatePath("/settings/suppliers");
  return {};
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ deleted?: string; deactivated?: string }> }) {
  const params = await searchParams;
  const deleted = params?.deleted;
  const deactivated = params?.deactivated;

  const rows = await db
    .select()
    .from(suppliers)
    .orderBy(desc(suppliers.createdAt));

  const usage = await db
    .select({
      id: inventoryMovements.supplierId,
      c: sql<number>`count(*)`,
    })
    .from(inventoryMovements)
    .groupBy(inventoryMovements.supplierId);
  const usedIds = new Set(usage.filter((u) => u.id !== null).map((u) => u.id as string));
  const supplierIds = rows.map((r) => r.id);
  const movementRows: Array<{
    supplierId: string | null;
    reason: string | null;
    type: string | null;
    createdAt: Date | null;
  }> = supplierIds.length > 0
    ? await db
        .select({
          supplierId: inventoryMovements.supplierId,
          reason: inventoryMovements.reason,
          type: inventoryMovements.type,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .where(inArray(inventoryMovements.supplierId, supplierIds))
    : [];
  function isRestock(reason: string | null, type: string | null) {
    const t = String(type || "");
    const r = String(reason || "");
    return t === "ADJUSTMENT" && r.startsWith("Manual restock");
  }
  function parseTotalFromReason(reason: string | null) {
    const r = String(reason || "");
    const m = r.match(/total=([0-9.]+)/);
    return m ? Number(m[1]) || 0 : 0;
  }
  const summaryBySupplier = new Map<string, { totalSpend: number; count: number; lastDate: string | null }>();
  for (const mv of movementRows) {
    const sid = String(mv.supplierId || "");
    if (!sid) continue;
    if (!isRestock(mv.reason, mv.type)) continue;
    const total = parseTotalFromReason(mv.reason);
    const createdAt = mv.createdAt ? String(mv.createdAt) : null;
    const curr = summaryBySupplier.get(sid) || { totalSpend: 0, count: 0, lastDate: null };
    const lastDate =
      curr.lastDate && createdAt
        ? (new Date(createdAt).getTime() > new Date(curr.lastDate).getTime() ? createdAt : curr.lastDate)
        : (createdAt || curr.lastDate);
    summaryBySupplier.set(sid, {
      totalSpend: curr.totalSpend + total,
      count: curr.count + 1,
      lastDate,
    });
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/settings">
            ← Back to Settings
          </Link>
          <h1 className="text-xl font-semibold">Suppliers</h1>
        </div>
        <Link className="underline" href="/settings/suppliers">
          Refresh
        </Link>
      </div>
      {deleted && (
        <div className="border border-success/20 bg-success/15 text-success p-3 rounded">
          Supplier deleted
        </div>
      )}
      {deactivated && (
        <div className="border border-warning/20 bg-warning/15 text-warning p-3 rounded">
          Supplier deactivated (used in restocks)
        </div>
      )}

      <div id="new-supplier">
        <SupplierForm action={createSupplier} />
      </div>

      {rows.length === 0 ? (
        <div className="py-12 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-lg font-medium">No suppliers added</div>
            <div className="text-muted-foreground">
              Manage where you purchase inventory from.
            </div>
            <Link
              className="inline-block mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
              href="#new-supplier"
            >
              Add Supplier
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 border-b border-border">Name</th>
                <th className="text-left p-2 border-b border-border">Total Spend</th>
                <th className="text-left p-2 border-b border-border">Restock Count</th>
                <th className="text-left p-2 border-b border-border">Last Restock</th>
                <th className="text-left p-2 border-b border-border">Status</th>
                <th className="text-left p-2 border-b border-border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border">
                  <td className="p-2">
                    <div>
                      <Link className="underline hover:text-primary" href={`/settings/suppliers/${m.id}`}>{m.name}</Link>
                    </div>
                    {m.note && <div className="text-xs text-muted-foreground mt-0.5">{m.note}</div>}
                  </td>
                  <td className="p-2">
                    {(() => {
                      const s = summaryBySupplier.get(m.id);
                      return s && s.count > 0 ? fmtCurrencyNaira(s.totalSpend) : "—";
                    })()}
                  </td>
                  <td className="p-2">
                    {(() => {
                      const s = summaryBySupplier.get(m.id);
                      return s ? s.count : 0;
                    })()}
                  </td>
                  <td className="p-2">
                    {(() => {
                      const s = summaryBySupplier.get(m.id);
                      return s && s.lastDate ? String(s.lastDate) : "—";
                    })()}
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        m.isActive
                          ? "bg-success/15 text-success"
                          : "bg-warning/15 text-warning"
                      }`}
                    >
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-2">
                    <SupplierActions
                      id={m.id}
                      isActive={!!m.isActive}
                      usedInMovements={usedIds.has(m.id)}
                      deactivateAction={deactivateSupplier}
                      reactivateAction={reactivateSupplier}
                      deleteAction={deleteSupplier}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
