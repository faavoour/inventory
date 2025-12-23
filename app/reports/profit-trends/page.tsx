import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import Link from "next/link";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { fmtCurrencyNaira } from "@/lib/format";
import Charts from "./Charts";

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function ymd(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function parseYMDUTC(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export default async function Page() {
  // Fixed view: Daily trend for the last 7 days
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 6);
  const defaultStartStr = ymd(defaultStart);
  const defaultEndStr = ymd(new Date());

  const startDate = parseYMDUTC(defaultStartStr);
  const endDate = parseYMDUTC(defaultEndStr);
  // End date for query should be exclusive (next day)
  const endDateExclusive = new Date(endDate);
  endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);

  const buckets: Array<{ label: string; start: Date; endExclusive: Date }> = [];
  
  // Daily buckets
  const cur = new Date(startDate);
  while (cur < endDateExclusive) {
    const next = new Date(cur);
    next.setUTCDate(next.getUTCDate() + 1);
    buckets.push({ label: ymd(cur), start: new Date(cur), endExclusive: next });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const results: Array<{ label: string; revenue: number; cogs: number; profit: number; margin: number }> = [];
  for (const b of buckets) {
    const sStr = ymd(b.start);
    const eStr = ymd(b.endExclusive);
    
    const revenueRows = await db
      .select({ price: saleItems.totalPrice, saleDate: sales.saleDate })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(gte(sales.saleDate, sStr), lt(sales.saleDate, eStr)));
    const revenue = revenueRows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

    const movementRows = await db
      .select({ change: inventoryMovements.changeAmount, createdAt: inventoryMovements.createdAt, costPerUnit: inventoryItems.costPerUnit })
      .from(inventoryMovements)
      .innerJoin(inventoryItems, eq(inventoryMovements.inventoryItemId, inventoryItems.id))
      .where(
        and(
          gte(inventoryMovements.createdAt, b.start),
          lt(inventoryMovements.createdAt, b.endExclusive),
          sql`${inventoryMovements.type} = 'SALE' OR (${inventoryMovements.type} IS NULL AND ${inventoryMovements.changeAmount} < 0)`
        )
      );
    const cogs = movementRows.reduce((sum, m) => sum + Math.abs(Number(m.change) || 0) * (Number(m.costPerUnit) || 0), 0);
    const profit = revenue - cogs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    results.push({ label: b.label, revenue, cogs, profit, margin });
  }

  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
  const totalCogs = results.reduce((sum, r) => sum + r.cogs, 0);
  const totalProfit = totalRevenue - totalCogs;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const trend = results;
  const margins = results.map((r) => ({ label: r.label, margin: r.margin }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/reports">
            ← Back to Reports
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Profit Trends</h1>
            <div className="text-sm text-slate-500">Revenue, COGS, profit, and margins over time.</div>
          </div>
        </div>
      </div>

      {/* Filter UI removed as requested */}

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

      <Charts trend={trend} margins={margins} />

      {trend.length === 0 ? (
        <div className="text-muted-foreground">No sales in selected period</div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Showing last 7 days.</div>
        </div>
      )}
    </div>
  );
}
