import { db } from "@/lib/db";
import { suppliers } from "@/db/schema/suppliers";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import Link from "next/link";
import { and, eq, gte, lt, desc } from "drizzle-orm";
import { fmtCurrencyNaira } from "@/lib/format";

function parseTotalFromReason(reason: string | null) {
  const r = String(reason || "");
  const m = r.match(/total=([0-9.]+)/);
  return m ? Number(m[1]) || 0 : 0;
}

function isRestock(reason: string | null, type: unknown) {
  const t = String(type || "");
  const r = String(reason || "");
  return t === "ADJUSTMENT" && r.startsWith("Manual restock");
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ start?: string; end?: string; itemId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const start = sp?.start;
  const end = sp?.end;
  const itemId = sp?.itemId;

  const srows = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (srows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link className="text-primary hover:underline" href="/settings/suppliers">
            ← Back to Suppliers
          </Link>
          <h1 className="text-xl font-semibold">Supplier Not Found</h1>
        </div>
      </div>
    );
  }
  const supplier = srows[0];

  const conds: Array<ReturnType<typeof and> | ReturnType<typeof eq>> = [eq(inventoryMovements.supplierId, id)];
  if (start) conds.push(gte(inventoryMovements.createdAt, new Date(start)));
  if (end) conds.push(lt(inventoryMovements.createdAt, new Date(end)));
  if (itemId) conds.push(eq(inventoryMovements.inventoryItemId, itemId));
  const where = conds.length > 1 ? and(...conds) : conds[0];

  const rows = await db
    .select({
      createdAt: inventoryMovements.createdAt,
      changeAmount: inventoryMovements.changeAmount,
      reason: inventoryMovements.reason,
      type: inventoryMovements.type,
      itemId: inventoryItems.id,
      itemName: inventoryItems.name,
    })
    .from(inventoryMovements)
    .innerJoin(inventoryItems, eq(inventoryMovements.inventoryItemId, inventoryItems.id))
    .where(where)
    .orderBy(desc(inventoryMovements.createdAt));
  const restocks = rows.filter((r) => isRestock(r.reason, r.type));

  const totalSpend = restocks.reduce((sum, r) => sum + parseTotalFromReason(r.reason), 0);
  const totalQty = restocks.reduce((sum, r) => sum + (Number(r.changeAmount) || 0), 0);
  const avgCost = totalQty > 0 ? totalSpend / totalQty : 0;
  const lastDate = restocks.length > 0 ? String(restocks[0].createdAt) : null;

  const items = Array.from(
    new Set(restocks.map((r) => ({ id: r.itemId, name: r.itemName })).map((x) => JSON.stringify(x)))
  ).map((s) => JSON.parse(s) as { id: string; name: string });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/settings/suppliers">
            ← Back to Suppliers
          </Link>
          <h1 className="text-xl font-semibold">{supplier.name}</h1>
        </div>
        <Link className="underline" href={`/settings/suppliers/${id}`}>
          Refresh
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded border border-border p-3 bg-card text-card-foreground shadow-sm">
          <div className="text-xs text-muted-foreground">Total Spend</div>
          <div className="text-lg font-semibold">{restocks.length > 0 ? fmtCurrencyNaira(totalSpend) : "—"}</div>
        </div>
        <div className="rounded border border-border p-3 bg-card text-card-foreground shadow-sm">
          <div className="text-xs text-muted-foreground">Total Quantity Supplied</div>
          <div className="text-lg font-semibold">{totalQty > 0 ? totalQty : "—"}</div>
        </div>
        <div className="rounded border border-border p-3 bg-card text-card-foreground shadow-sm">
          <div className="text-xs text-muted-foreground">Average Cost per Unit</div>
          <div className="text-lg font-semibold">{totalQty > 0 ? fmtCurrencyNaira(avgCost) : "—"}</div>
        </div>
        <div className="rounded border border-border p-3 bg-card text-card-foreground shadow-sm">
          <div className="text-xs text-muted-foreground">Last Restock Date</div>
          <div className="text-lg font-semibold">{lastDate ? String(lastDate) : "—"}</div>
        </div>
      </div>

      <div className="rounded border border-border p-3 bg-card text-card-foreground shadow-sm space-y-3">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium">Start Date</label>
            <input
              name="start"
              type="date"
              defaultValue={start ?? ""}
              className="mt-1 w-full border border-input bg-background rounded-md px-2 py-1 focus:ring-2 focus:ring-ring focus:border-input outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">End Date</label>
            <input
              name="end"
              type="date"
              defaultValue={end ?? ""}
              className="mt-1 w-full border border-input bg-background rounded-md px-2 py-1 focus:ring-2 focus:ring-ring focus:border-input outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Inventory Item</label>
            <select name="itemId" defaultValue={itemId ?? ""} className="mt-1 w-full border border-input bg-background rounded-md px-2 py-1 focus:ring-2 focus:ring-ring focus:border-input outline-none">
              <option value="">All</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="px-3 py-2 rounded border border-border hover:bg-muted">
              Apply
            </button>
          </div>
        </form>
      </div>

      {restocks.length === 0 ? (
        <div className="py-12 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-lg font-medium">No restocks recorded for this supplier yet</div>
            <div className="text-muted-foreground">Track restocks to see purchase history.</div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 border-b border-border">Date</th>
                <th className="text-left p-2 border-b border-border">Inventory Item Name</th>
                <th className="text-left p-2 border-b border-border">Quantity Added</th>
                <th className="text-left p-2 border-b border-border">Total Purchase Price</th>
                <th className="text-left p-2 border-b border-border">Cost per Unit</th>
              </tr>
            </thead>
            <tbody>
              {restocks.map((r, idx) => {
                const total = parseTotalFromReason(r.reason);
                const qty = Number(r.changeAmount) || 0;
                const unitCost = qty > 0 ? total / qty : 0;
                return (
                  <tr key={`${String(r.createdAt)}-${idx}`} className="border-b border-border">
                    <td className="p-2">{String(r.createdAt)}</td>
                    <td className="p-2">{r.itemName}</td>
                    <td className="p-2">{qty}</td>
                    <td className="p-2">{fmtCurrencyNaira(total)}</td>
                    <td className="p-2">{fmtCurrencyNaira(unitCost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
