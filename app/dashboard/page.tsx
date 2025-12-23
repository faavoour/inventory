import { db } from "@/lib/db";
import { sales } from "@/db/schema/sales";
import { expenses } from "@/db/schema/expenses";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import { paymentMethods } from "@/db/schema/paymentMethods";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { expenseRangeFromParams, getExpensePresets } from "@/lib/dateRange";
import DatePresets from "@/components/filters/DatePresets";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;
  const presets = getExpensePresets();
  const todayPreset = presets[0];

  const startStr = start && start.length > 0 ? start : todayPreset.start;
  const endStr = end && end.length > 0 ? end : todayPreset.end;

  const { startStr: expenseStartStr, endExclusiveStr: expenseEndExclusiveStr } = expenseRangeFromParams(
    startStr,
    endStr
  );
  
  // Find if current range matches a preset for the label
  const matchedPreset = presets.find(p => p.start === startStr && p.end === endStr);
  const label = matchedPreset?.label ?? `${startStr} to ${endStr}`;

  const salesRows = await db
    .select({ id: sales.id })
    .from(sales)
    .where(and(gte(sales.saleDate, expenseStartStr!), lt(sales.saleDate, expenseEndExclusiveStr!)));
  const expenseRows = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, expenseStartStr!), lt(expenses.expenseDate, expenseEndExclusiveStr!)));
  const saleIds = salesRows.map((s) => s.id);
  const expenseIds = expenseRows.map((e) => e.id);

  const saleAllocs = saleIds.length
    ? await db
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "SALE"), inArray(paymentAllocations.entityId, saleIds)))
    : [];
  const expenseAllocs = expenseIds.length
    ? await db
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "EXPENSE"), inArray(paymentAllocations.entityId, expenseIds)))
    : [];

  const totalSales = saleAllocs.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalExpenses = expenseAllocs.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const netCashFlow = totalSales - totalExpenses;

  const methods = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true));
  const nameById = new Map(methods.map((m) => [m.id, m.name]));
  const totalsByMethod = new Map<string, number>();
  for (const a of saleAllocs) {
    const nm = nameById.get(a.paymentMethodId) ?? "—";
    const amt = Number(a.amount) || 0;
    totalsByMethod.set(nm, (totalsByMethod.get(nm) || 0) + amt);
  }
  const breakdownRows = Array.from(totalsByMethod.entries()).map(([name, total]) => ({ name, total }));
  const breakdownTotal = breakdownRows.reduce((sum, r) => sum + r.total, 0);

  const netColor =
    netCashFlow >= 0
      ? "text-success bg-success/15 border-success/20"
      : "text-destructive bg-destructive/15 border-destructive/20";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>
      
      <div className="text-sm text-muted-foreground">{label}</div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
        <DatePresets presets={presets} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="text-sm text-muted-foreground">Total Sales</div>
          <div className="text-2xl font-semibold">{formatCurrency(totalSales)}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="text-sm text-muted-foreground">Total Expenses</div>
          <div className="text-2xl font-semibold">{formatCurrency(totalExpenses)}</div>
        </div>
        <div className={`p-4 rounded-lg border shadow-sm ${netColor}`}>
          <div className="text-sm">Net Cash Flow</div>
          <div className="text-2xl font-semibold">{formatCurrency(netCashFlow)}</div>
        </div>
      </div>

      {saleIds.length > 0 ? (
        <TopSellingItems startStr={expenseStartStr!} endExclusiveStr={expenseEndExclusiveStr!} />
      ) : (
        <div className="text-sm text-muted-foreground">No sales in range</div>
      )}

      <div className="space-y-2">
        <div className="font-medium">Payment Method Breakdown</div>
        {breakdownRows.length === 0 ? (
          <div className="text-muted-foreground">No payments in range</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm border border-border">
              <thead>
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Payment Method</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Amount Received</th>
                </tr>
              </thead>
              <tbody>
                {breakdownRows.map((b) => (
                  <tr key={b.name} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-2 align-middle">{b.name}</td>
                    <td className="p-2 align-middle">{formatCurrency(b.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="p-2 align-middle font-semibold">Total</td>
                  <td className="p-2 align-middle font-semibold">{formatCurrency(breakdownTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

async function TopSellingItems({ startStr, endExclusiveStr }: { startStr: string; endExclusiveStr: string }) {
  const { saleItems, sales } = await import("@/db/schema/sales");
  const { menuItems, recipeItems } = await import("@/db/schema/menu");
  const { inventoryItems } = await import("@/db/schema/inventory");
  const { and, gte, lt, eq, sql } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
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
    .where(and(gte(sales.saleDate, startStr), lt(sales.saleDate, endExclusiveStr)))
    .groupBy(menuItems.id, menuItems.name);
  const topQty = aggRows
    .map((r) => ({ id: r.menuItemId as string, name: r.name ?? "—", qty: Number(r.qty) || 0 }))
    .filter((r) => r.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3);
  const recipeCosts = await db
    .select({
      menuItemId: recipeItems.menuItemId,
      unitCost: sql<number>`sum(${recipeItems.quantityRequired} * ${inventoryItems.costPerUnit})`,
    })
    .from(recipeItems)
    .innerJoin(inventoryItems, eq(recipeItems.inventoryItemId, inventoryItems.id))
    .groupBy(recipeItems.menuItemId);
  const unitCostByMenu = new Map<string, number>(recipeCosts.map((r) => [r.menuItemId as string, Number(r.unitCost) || 0]));
  const topProfit = aggRows
    .map((r) => {
      const qty = Number(r.qty) || 0;
      const revenue = Number(r.revenue) || 0;
      const unitCost = unitCostByMenu.get(r.menuItemId as string) || 0;
      const cogs = qty * unitCost;
      const profit = revenue - cogs;
      return { id: r.menuItemId as string, name: r.name ?? "—", profit };
    })
    .filter((r) => (r.profit || 0) > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);
  return (
    <div className="space-y-2">
      <div className="text-lg font-semibold">Top Selling Items</div>
      {topQty.length === 0 && topProfit.length === 0 ? (
        <div className="text-muted-foreground">No sales for this period</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card text-card-foreground border border-border rounded-lg p-4">
            <div className="font-medium">Top Items by Quantity</div>
            <div className="mt-2 space-y-2">
              {topQty.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div>{t.name}</div>
                  <div className="font-semibold">{t.qty}</div>
                </div>
              ))}
              {topQty.length === 0 ? <div className="text-muted-foreground">No items sold</div> : null}
            </div>
          </div>
          <div className="bg-card text-card-foreground border border-border rounded-lg p-4">
            <div className="font-medium">Top Items by Profit</div>
            <div className="mt-2 space-y-2">
              {topProfit.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div>{t.name}</div>
                  <div className="font-semibold">{formatCurrency(t.profit)}</div>
                </div>
              ))}
              {topProfit.length === 0 ? <div className="text-muted-foreground">No profitable items</div> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
