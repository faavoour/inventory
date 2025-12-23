import { db } from "@/lib/db";
import { inventoryItems } from "@/db/schema/inventory";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { formatBaseQuantity } from "@/lib/baseUnitDisplay";
import { fmtCurrencyNaira } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [invRows] = await Promise.all([
    db.select().from(inventoryItems).where(eq(inventoryItems.type, "RAW")),
  ]);

  const items = invRows.map((r) => {
    // Stored values (Base Units Only)
    // Strict Rule: Use baseQuantity and costPerBaseUnit.
    const baseQty = r.baseQuantity !== null ? Number(r.baseQuantity) : 0;
    const baseCost = r.costPerBaseUnit !== null ? Number(r.costPerBaseUnit) : 0;
    
    // Total Value = Base Quantity * Cost Per Base Unit
    const total = baseQty * baseCost;

    // Display values: ALWAYS BASE UNITS
    const displayQtyString = formatBaseQuantity(baseQty, r.baseUnit || "pcs");

    return {
      id: r.id,
      name: r.name,
      qtyString: displayQtyString,
      costPerBaseUnit: baseCost,
      totalValue: total,
    };
  });

  const totalValueRaw = items.reduce((sum, it) => sum + it.totalValue, 0);
  const totalItemsRaw = items.length;

  const totalValueAll = totalValueRaw;

  const sortedRaw = items.slice().sort((a, b) => b.totalValue - a.totalValue);
  
  const topCountRaw = Math.max(1, Math.floor(sortedRaw.length * 0.2));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/reports">
            ← Back to Reports
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Inventory Valuation</h1>
            <div className="text-sm text-slate-500">Shows the total value of your current RAW inventory based on weighted average cost. Prep items are excluded.</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Asset Value (Raw)</div>
          <div className="text-2xl font-bold mt-2">{fmtCurrencyNaira(totalValueAll)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Raw Items</div>
          <div className="text-2xl font-bold mt-2">{totalItemsRaw}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Raw Inventory</h2>
        {sortedRaw.length === 0 ? (
          <div className="py-6 flex items-center justify-center border rounded-md">
            <div className="text-center space-y-2">
              <div className="text-muted-foreground">No raw inventory items</div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 transition-colors hover:bg-muted/50">
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Quantity</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Cost per Base Unit</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Total Value</th>
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">% Share</th>
                </tr>
              </thead>
              <tbody>
                {sortedRaw.map((it, idx) => {
                  const share = totalValueRaw > 0 ? (it.totalValue / totalValueRaw) * 100 : 0;
                  const highlight = idx < topCountRaw;
                  const rowCls = highlight ? "bg-muted/30" : "";
                  return (
                    <tr key={it.id} className={`border-b border-border transition-colors hover:bg-muted/50 ${rowCls}`}>
                      <td className="p-4 align-middle">{it.name}</td>
                      <td className="p-4 align-middle">{it.qtyString}</td>
                      <td className="p-4 align-middle">{fmtCurrencyNaira(it.costPerBaseUnit)}</td>
                      <td className="p-4 align-middle font-medium">{fmtCurrencyNaira(it.totalValue)}</td>
                      <td className="p-4 align-middle">{share.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
