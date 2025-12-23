import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { menuItems, recipeItems } from "@/db/schema/menu";
import { inventoryItems } from "@/db/schema/inventory";
import { prepInventory } from "@/db/schema/prep";
import Link from "next/link";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { fmtCurrencyNaira } from "@/lib/format";
import { expenseRangeFromParams, getExpensePresets } from "@/lib/dateRange";
import Charts from "./Charts";
import DatePresets from "@/components/filters/DatePresets";

type SortKey = "name" | "qty" | "revenue" | "cogs" | "profit" | "margin";
type SortDir = "asc" | "desc";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    preset?: "today" | "yesterday" | "week" | "month";
    sort?: SortKey;
    dir?: SortDir;
  }>;
}) {
  const { start, end, preset, sort, dir } = await searchParams;

  const presets = getExpensePresets();
  const todayPreset = presets[0];
  const selectedPreset =
    preset === "today"
      ? presets[0]
      : preset === "yesterday"
      ? presets[1]
      : preset === "week"
      ? presets[2]
      : preset === "month"
      ? presets[3]
      : undefined;

  const useStart = selectedPreset ? selectedPreset.start : start ?? todayPreset.start;
  const useEnd = selectedPreset ? selectedPreset.end : end ?? todayPreset.end;

  const { startStr: expenseStartStr, endExclusiveStr: expenseEndExclusiveStr } = expenseRangeFromParams(
    useStart,
    useEnd
  );
  const label =
    (selectedPreset?.label ?? undefined) ??
    (start && end ? `Selected: ${start} → ${end}` : `Selected: ${useStart}`);

  const aggRows = await db
    .select({
      menuItemId: menuItems.id,
      name: menuItems.name,
      qty: sql<number>`sum(${saleItems.quantity})`,
      revenue: sql<number>`sum(${saleItems.totalPrice})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(menuItems, eq(saleItems.menuItemId, menuItems.id))
    .where(and(gte(sales.saleDate, expenseStartStr!), lt(sales.saleDate, expenseEndExclusiveStr!)))
    .groupBy(menuItems.id, menuItems.name);

  const unitCosts = await db
    .select({
      menuItemId: recipeItems.menuItemId,
      unitCost: sql<number>`sum(
        CASE 
          WHEN ${recipeItems.prepItemId} IS NOT NULL THEN
             COALESCE(${recipeItems.baseQuantity}, 0) * COALESCE(${prepInventory.costPerBaseUnit}, 0)
          WHEN ${recipeItems.inventoryItemId} IS NOT NULL THEN
             CASE
               WHEN ${recipeItems.baseQuantity} IS NOT NULL AND ${inventoryItems.costPerBaseUnit} IS NOT NULL 
               THEN ${recipeItems.baseQuantity} * ${inventoryItems.costPerBaseUnit}
               ELSE ${recipeItems.quantityRequired} * ${inventoryItems.costPerUnit}
             END
          ELSE 0
        END
      )`,
    })
    .from(recipeItems)
    .leftJoin(inventoryItems, eq(recipeItems.inventoryItemId, inventoryItems.id))
    .leftJoin(prepInventory, eq(recipeItems.prepItemId, prepInventory.prepItemId))
    .groupBy(recipeItems.menuItemId);
  const unitCostByMenu = new Map<string, number>(
    unitCosts.map((r) => [r.menuItemId as string, Number(r.unitCost) || 0])
  );

  const rows = aggRows
    .map((r) => {
      const qty = Number(r.qty) || 0;
      const revenue = Number(r.revenue) || 0;
      const unitCost = unitCostByMenu.get(r.menuItemId as string) || 0;
      const cogs = qty * unitCost;
      const profit = revenue - cogs;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        id: r.menuItemId as string,
        name: r.name ?? "—",
        qty,
        revenue,
        cogs,
        profit,
        margin,
      };
    })
    .filter((r) => (r.qty || 0) > 0);

  const sortKey: SortKey = (sort as SortKey) ?? "profit";
  const sortDir: SortDir = (dir as SortDir) ?? "desc";
  const cmp = (a: typeof rows[number], b: typeof rows[number]) => {
    const va = sortKey === "name" ? a.name : a[sortKey];
    const vb = sortKey === "name" ? b.name : b[sortKey];
    const res =
      typeof va === "string" && typeof vb === "string"
        ? va.localeCompare(vb)
        : (va as number) - (vb as number);
    return sortDir === "asc" ? res : -res;
  };
  const sorted = rows.sort(cmp);

  const totalRevenue = sorted.reduce((sum, r) => sum + r.revenue, 0);
  const totalCogs = sorted.reduce((sum, r) => sum + r.cogs, 0);
  const totalProfit = totalRevenue - totalCogs;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const topProfit = [...sorted]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5)
    .map((r) => ({ name: r.name, profit: r.profit }));
  const topQty = [...sorted]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
    .map((r) => ({ name: r.name, qty: r.qty }));

  const q = new URLSearchParams();
  if (useStart) q.set("start", useStart);
  if (useEnd) q.set("end", useEnd);
  const withSort = (k: SortKey) => {
    const params = new URLSearchParams(q.toString());
    const current = sortKey;
    const currentDir = sortDir;
    const nextDir: SortDir = current === k && currentDir === "desc" ? "asc" : "desc";
    params.set("sort", k);
    params.set("dir", nextDir);
    return `/reports/menu-item-profitability?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/reports">
            ← Back to Reports
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Menu Item Profitability</h1>
            <div className="text-sm text-slate-500">Profitability by menu item using existing sales and costs.</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 md:pb-0">
        <DatePresets presets={presets} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/reports/menu-item-profitability/unit-profit" className="block p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold mb-2">Menu Item Unit Profit</h3>
          <p className="text-sm text-muted-foreground">
            Profit per menu item based on current cost and pricing (per unit)
          </p>
        </Link>
        <Link href="/reports/menu-item-profitability/production-capacity" className="block p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold mb-2">Menu Production Capacity</h3>
          <p className="text-sm text-muted-foreground">
            How many units of each menu item can be made from current inventory
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
          <div className="text-2xl font-bold mt-2">{fmtCurrencyNaira(totalRevenue)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total COGS</div>
          <div className="text-2xl font-bold mt-2">{fmtCurrencyNaira(totalCogs)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Profit</div>
          <div className="text-2xl font-bold mt-2">{fmtCurrencyNaira(totalProfit)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Average Profit Margin</div>
          <div className="text-2xl font-bold mt-2">{`${Math.round(avgMargin)}%`}</div>
        </div>
      </div>

      <Charts topProfit={topProfit} topQty={topQty} />

      {sorted.length === 0 ? (
        <div className="text-muted-foreground">No sales in selected period</div>
      ) : (
        <div className="space-y-2">
          <div className="font-medium">Profitability by Item</div>
          <div className="rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 transition-colors hover:bg-muted/50">
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                    <Link href={withSort("name")} className="underline">Menu Item Name</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("qty")} className="underline">Quantity Sold</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("revenue")} className="underline">Revenue</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("cogs")} className="underline">COGS</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("profit")} className="underline">Profit</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("margin")} className="underline">Profit Margin (%)</Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b border-border transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">{r.name}</td>
                    <td className="p-4 align-middle text-right">{r.qty}</td>
                    <td className="p-4 align-middle text-right">{fmtCurrencyNaira(r.revenue)}</td>
                    <td className="p-4 align-middle text-right">{fmtCurrencyNaira(r.cogs)}</td>
                    <td className={`p-4 align-middle text-right ${r.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {fmtCurrencyNaira(r.profit)}
                    </td>
                    <td className="p-4 align-middle text-right">{`${Math.round(r.margin)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
