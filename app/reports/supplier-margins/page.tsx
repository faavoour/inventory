import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { suppliers } from "@/db/schema/suppliers";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { recipeItems } from "@/db/schema/menu";
import Link from "next/link";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { fmtCurrencyNaira } from "@/lib/format";
import { expenseRangeFromParams, getExpensePresets } from "@/lib/dateRange";
import Charts from "./Charts";

import DatePresets from "@/components/filters/DatePresets";

type SortKey = "name" | "revenue" | "cogs" | "profit" | "margin";
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
  const { startStr, endExclusiveStr } = expenseRangeFromParams(useStart, useEnd);
  
  // label logic can be simplified or removed as DatePresets + Text handles it


  const allSuppliers = await db.select().from(suppliers).orderBy(suppliers.name);

  const restocks = await db
    .select({
      supplierId: inventoryMovements.supplierId,
      inventoryItemId: inventoryMovements.inventoryItemId,
    })
    .from(inventoryMovements)
    .where(
      and(
        sql`${inventoryMovements.type} = 'ADJUSTMENT'`,
        sql`${inventoryMovements.changeAmount} > 0`,
        sql`${inventoryMovements.supplierId} IS NOT NULL`
      )
    );
  const invBySupplier = new Map<string, Set<string>>();
  for (const r of restocks) {
    const sid = r.supplierId as string | null;
    const iid = r.inventoryItemId as string | null;
    if (!sid || !iid) continue;
    const set = invBySupplier.get(sid) ?? new Set<string>();
    set.add(iid);
    invBySupplier.set(sid, set);
  }

  const recipeRows = await db.select().from(recipeItems);
  const menuByInventory = new Map<string, Set<string>>();
  const invUsedAnywhere = new Set<string>();
  for (const r of recipeRows) {
    const iid = r.inventoryItemId as string;
    const mid = r.menuItemId as string;
    invUsedAnywhere.add(iid);
    const set = menuByInventory.get(iid) ?? new Set<string>();
    set.add(mid);
    menuByInventory.set(iid, set);
  }

  const menuUnitCosts = await db
    .select({
      menuItemId: recipeItems.menuItemId,
      unitCost: sql<number>`sum(${recipeItems.quantityRequired} * ${inventoryItems.costPerUnit})`,
    })
    .from(recipeItems)
    .innerJoin(inventoryItems, eq(recipeItems.inventoryItemId, inventoryItems.id))
    .groupBy(recipeItems.menuItemId);
  const unitCostByMenu = new Map<string, number>(
    menuUnitCosts.map((r) => [r.menuItemId as string, Number(r.unitCost) || 0])
  );

  const salesAgg = await db
    .select({
      menuItemId: saleItems.menuItemId,
      revenue: sql<number>`sum(${saleItems.totalPrice})`,
      qty: sql<number>`sum(${saleItems.quantity})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, startStr!), lt(sales.saleDate, endExclusiveStr!)))
    .groupBy(saleItems.menuItemId);
  const revenueByMenu = new Map<string, number>(salesAgg.map((r) => [r.menuItemId as string, Number(r.revenue) || 0]));
  const qtyByMenu = new Map<string, number>(salesAgg.map((r) => [r.menuItemId as string, Number(r.qty) || 0]));

  const rows = allSuppliers.map((s) => {
    const sid = s.id as string;
    const invIds = invBySupplier.get(sid) ?? new Set<string>();
    const menuIds = new Set<string>();
    for (const iid of invIds) {
      const ms = menuByInventory.get(iid);
      if (ms) for (const mid of ms) menuIds.add(mid);
    }
    let revenue = 0;
    let cogs = 0;
    for (const mid of menuIds) {
      const r = revenueByMenu.get(mid) || 0;
      const q = qtyByMenu.get(mid) || 0;
      const uc = unitCostByMenu.get(mid) || 0;
      revenue += r;
      cogs += q * uc;
    }
    const profit = revenue - cogs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return {
      id: sid,
      name: s.name,
      revenue,
      cogs,
      profit,
      margin,
    };
  }).filter((r) => Number.isFinite(r.revenue) && Number.isFinite(r.cogs));

  const sortKey: SortKey = (sort as SortKey) ?? "margin";
  const sortDir: SortDir = (dir as SortDir) ?? "asc";
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

  const chartData = sorted.map((r) => ({ name: r.name, margin: Number.isFinite(r.margin) ? Number(r.margin) : 0 }));

  const totalRevenue = sorted.reduce((sum, r) => sum + r.revenue, 0);
  const totalCogs = sorted.reduce((sum, r) => sum + r.cogs, 0);
  const totalProfit = totalRevenue - totalCogs;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const q = new URLSearchParams();
  if (useStart) q.set("start", useStart);
  if (useEnd) q.set("end", useEnd);
  const withSort = (k: SortKey) => {
    const params = new URLSearchParams(q.toString());
    const current = sortKey;
    const currentDir = sortDir;
    const nextDir: SortDir = current === k && currentDir === "asc" ? "desc" : "asc";
    params.set("sort", k);
    params.set("dir", nextDir);
    return `/reports/supplier-margins?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/reports">
            ← Back to Reports
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Supplier Impact on Menu Margins</h1>
            <div className="text-sm text-slate-500">Shows how suppliers influence menu item margins.</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 md:pb-0">
        <DatePresets presets={presets} />
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
          <div className="text-sm font-medium text-muted-foreground">Average Margin</div>
          <div className="text-2xl font-bold mt-2">{`${avgMargin.toFixed(1)}%`}</div>
        </div>
      </div>

      <Charts data={chartData} />

      {sorted.length === 0 || sorted.every((r) => (r.revenue || 0) === 0) ? (
        <div className="text-muted-foreground">No sales in selected period</div>
      ) : (
        <div className="space-y-2">
          <div className="font-medium">Supplier Impact</div>
          <div className="rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 transition-colors hover:bg-muted/50">
                  <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                    <Link href={withSort("name")} className="underline">Supplier Name</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("revenue")} className="underline">Revenue Impacted</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("cogs")} className="underline">COGS Attributed</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("profit")} className="underline">Profit</Link>
                  </th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                    <Link href={withSort("margin")} className="underline">Avg Margin %</Link>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b border-border transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">{r.name}</td>
                    <td className="p-4 align-middle text-right">{fmtCurrencyNaira(r.revenue)}</td>
                    <td className="p-4 align-middle text-right">{fmtCurrencyNaira(r.cogs)}</td>
                    <td className={`p-4 align-middle text-right ${r.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {fmtCurrencyNaira(r.profit)}
                    </td>
                    <td className="p-4 align-middle text-right">{r.margin.toFixed(1)}%</td>
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
