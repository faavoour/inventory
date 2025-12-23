import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { recipeItems } from "@/db/schema/menu";
import { expenses } from "@/db/schema/expenses";
import { alertSettings } from "@/db/schema/alertSettings";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getExpensePresets, salesRangeFromParams, expenseRangeFromParams } from "@/lib/dateRange";
import { fmtCurrencyNaira } from "@/lib/format";

type Insight = {
  level: "critical" | "warning" | "positive" | "info";
  title: string;
  message: string;
  details?: string[];
};

function clsFor(level: Insight["level"]) {
  if (level === "critical") return "border-destructive/20 bg-destructive/15 text-destructive";
  if (level === "warning") return "border-warning/20 bg-warning/15 text-warning";
  return "border-border bg-muted/50 text-muted-foreground";
}

// Use global currency formatter everywhere for consistency

export default async function Home() {
  const presets = getExpensePresets();
  const today = presets[0];
  const yesterday = presets[1];
  const thisWeek = presets[2];

  const srToday = salesRangeFromParams(today.start, today.end);
  const erToday = expenseRangeFromParams(today.start, today.end);
  const srYesterday = salesRangeFromParams(yesterday.start, yesterday.end);
  const erYesterday = expenseRangeFromParams(yesterday.start, yesterday.end);
  const srWeek = salesRangeFromParams(thisWeek.start, thisWeek.end);
  const erWeek = expenseRangeFromParams(thisWeek.start, thisWeek.end);

  const revenueRowsToday = await db
    .select({ price: saleItems.totalPrice })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, erToday.startStr!), lt(sales.saleDate, erToday.endExclusiveStr!)));
  const revenueToday = revenueRowsToday.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

  const movementRowsToday = await db
    .select({ change: inventoryMovements.changeAmount, costPerUnit: inventoryItems.costPerUnit })
    .from(inventoryMovements)
    .innerJoin(inventoryItems, eq(inventoryMovements.inventoryItemId, inventoryItems.id))
    .where(
      and(
        gte(inventoryMovements.createdAt, srToday.startDate!),
        lt(inventoryMovements.createdAt, srToday.endExclusiveDate!),
        sql`${inventoryMovements.type} = 'SALE' OR (${inventoryMovements.type} IS NULL AND ${inventoryMovements.changeAmount} < 0)`
      )
    );
  const cogsToday = movementRowsToday.reduce((sum, m) => sum + Math.abs(Number(m.change) || 0) * (Number(m.costPerUnit) || 0), 0);

  const expensesRowsToday = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, erToday.startStr!), lt(expenses.expenseDate, erToday.endExclusiveStr!)));
  const expensesToday = expensesRowsToday.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const profitToday = revenueToday - cogsToday - expensesToday;

  const revenueRowsYesterday = await db
    .select({ price: saleItems.totalPrice })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, erYesterday.startStr!), lt(sales.saleDate, erYesterday.endExclusiveStr!)));
  const revenueYesterday = revenueRowsYesterday.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
  const movementRowsYesterday = await db
    .select({ change: inventoryMovements.changeAmount, costPerUnit: inventoryItems.costPerUnit })
    .from(inventoryMovements)
    .innerJoin(inventoryItems, eq(inventoryMovements.inventoryItemId, inventoryItems.id))
    .where(
      and(
        gte(inventoryMovements.createdAt, srYesterday.startDate!),
        lt(inventoryMovements.createdAt, srYesterday.endExclusiveDate!),
        sql`${inventoryMovements.type} = 'SALE' OR (${inventoryMovements.type} IS NULL AND ${inventoryMovements.changeAmount} < 0)`
      )
    );
  const cogsYesterday = movementRowsYesterday.reduce((sum, m) => sum + Math.abs(Number(m.change) || 0) * (Number(m.costPerUnit) || 0), 0);
  const expensesRowsYesterday = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, erYesterday.startStr!), lt(expenses.expenseDate, erYesterday.endExclusiveStr!)));
  const expensesYesterday = expensesRowsYesterday.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const profitYesterday = revenueYesterday - cogsYesterday - expensesYesterday;

  const settingsRows = await db.select().from(alertSettings).limit(1);
  const cfg = settingsRows[0] || {
    profitDropPercent: 10,
    expenseSpikePercent: 150,
    cashFlowNegativeLimit: 10000,
    inventoryBlockCount: 2,
  };
  const dropPctThreshold = (Number(cfg.profitDropPercent) || 10) / 100;
  const spikePctThreshold = (Number(cfg.expenseSpikePercent) || 150) / 100;
  const cashFlowLimit = Number(cfg.cashFlowNegativeLimit) || 10000;
  const blockCount = Number(cfg.inventoryBlockCount) || 2;

  const insights: Insight[] = [];
  if (profitYesterday > 0) {
    const pct = (profitToday - profitYesterday) / profitYesterday;
    if (pct <= -dropPctThreshold) {
      insights.push({
        level: "warning",
        title: "Daily Profit",
        message: "Today’s profit is significantly lower than yesterday.",
      });
    }
  }

  const expensesRowsWeekExToday = await db
    .select({ amount: expenses.amount, d: expenses.expenseDate })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, erWeek.startStr!), lt(expenses.expenseDate, erToday.startStr!)));
  const byDay = new Map<string, number>();
  for (const r of expensesRowsWeekExToday) {
    const k = typeof r.d === "string" ? r.d : (r.d as Date).toISOString().slice(0, 10);
    const amt = Number(r.amount) || 0;
    byDay.set(k, (byDay.get(k) || 0) + amt);
  }
  const daysWithData = Array.from(byDay.values()).filter((x) => x > 0).length;
  const totalWeekExToday = Array.from(byDay.values()).reduce((sum, x) => sum + x, 0);
  const avgDailyWeekExToday = daysWithData > 0 ? totalWeekExToday / daysWithData : 0;
  if (daysWithData >= 2 && avgDailyWeekExToday > 0 && expensesToday > spikePctThreshold * avgDailyWeekExToday) {
    insights.push({
      level: "warning",
      title: "Expense Spike",
      message: "Expenses are unusually high today compared to this week.",
    });
  }

  const salesRowsToday = await db
    .select({ amount: sales.totalAmount })
    .from(sales)
    .where(and(gte(sales.saleDate, erToday.startStr!), lt(sales.saleDate, erToday.endExclusiveStr!)));
  const totalSalesToday = salesRowsToday.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const netCashFlowToday = totalSalesToday - expensesToday;
  if (netCashFlowToday < -cashFlowLimit) {
    insights.push({
      level: "critical",
      title: "Cash Flow",
      message: "Cash flow is significantly negative for this period.",
    });
  }
  const salesRowsWeek = await db
    .select({ amount: sales.totalAmount })
    .from(sales)
    .where(and(gte(sales.saleDate, erWeek.startStr!), lt(sales.saleDate, erWeek.endExclusiveStr!)));
  const totalSalesWeek = salesRowsWeek.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const netCashFlowWeek = totalSalesWeek - (totalWeekExToday + expensesToday);
  if (!(netCashFlowToday < -cashFlowLimit) && netCashFlowWeek < -cashFlowLimit) {
    insights.push({
      level: "critical",
      title: "Cash Flow",
      message: "Cash flow is significantly negative for this period.",
    });
  }

  const minRequiredByInventory = new Map<string, number>();
  const menuCountByInventory = new Map<string, number>();
  const recipeRowsActual = await db
    .select({
      inventoryItemId: recipeItems.inventoryItemId,
      quantityRequired: recipeItems.quantityRequired,
      menuItemId: recipeItems.menuItemId,
    })
    .from(recipeItems);
  for (const r of recipeRowsActual) {
    const invId = r.inventoryItemId!;
    const req = Number(r.quantityRequired) || 0;
    const prevMin = minRequiredByInventory.get(invId);
    if (prevMin === undefined) {
      minRequiredByInventory.set(invId, req);
    } else {
      minRequiredByInventory.set(invId, Math.min(prevMin, req));
    }
    menuCountByInventory.set(invId, (menuCountByInventory.get(invId) || 0) + 1);
  }
  const invRows = await db.select().from(inventoryItems);
  const lowInventory: Array<{ name: string; quantity: number; required: number; menuCount: number }> = [];
  for (const i of invRows) {
    const minReq = minRequiredByInventory.get(i.id);
    const qty = Number(i.quantity) || 0;
    const cnt = menuCountByInventory.get(i.id) || 0;
    if (qty === 0 || (cnt >= blockCount && minReq !== undefined && qty < minReq)) {
      lowInventory.push({ name: i.name, quantity: qty, required: minReq ?? 0, menuCount: cnt });
    }
  }
  if (lowInventory.length > 0) {
    insights.push({
      level: "critical",
      title: "Low Inventory",
      message: "Some inventory items may block menu availability.",
      details: lowInventory
        .slice(0, 6)
        .map((x) => `${x.name}: ${x.quantity}${x.required ? ` / min ${x.required}` : ""}${x.menuCount ? ` • uses: ${x.menuCount}` : ""}`),
    });
  }

  const ordered = insights
    .filter((x) => x.level === "critical" || x.level === "warning")
    .sort((a, b) => {
      const rank = (l: Insight["level"]) => (l === "critical" ? 2 : l === "warning" ? 1 : 0);
      return rank(b.level) - rank(a.level);
    })
    .slice(0, 3);

  const maxToday = Math.max(revenueToday, expensesToday, 1);
  const salesPct = Math.round((revenueToday / maxToday) * 100);
  const expensesPct = Math.round((expensesToday / maxToday) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-border bg-card text-card-foreground rounded p-4">
          <div className="text-sm text-muted-foreground">Sales (Today)</div>
          <div className="text-2xl font-semibold">{fmtCurrencyNaira(revenueToday)}</div>
        </div>
        <div className="border border-border bg-card text-card-foreground rounded p-4">
          <div className="text-sm text-muted-foreground">Expenses (Today)</div>
          <div className="text-2xl font-semibold">{fmtCurrencyNaira(expensesToday)}</div>
        </div>
        <div className="border border-border bg-card text-card-foreground rounded p-4">
          <div className="text-sm text-muted-foreground">Profit (Today)</div>
          <div className="text-2xl font-semibold">{fmtCurrencyNaira(profitToday)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {ordered.length === 0 ? (
          <div className="border rounded p-3 border-border bg-card text-card-foreground">
            Everything looks good today.
          </div>
        ) : (
          ordered.map((ins, idx) => (
            <div key={idx} className={`p-3 border rounded ${clsFor(ins.level)}`}>
              <div className="font-medium">{ins.title}</div>
              <div className="text-sm mt-1">{ins.message}</div>
              {ins.details && ins.details.length > 0 && (
                <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
                  {ins.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border border-border bg-card text-card-foreground rounded p-4">
        <div className="text-sm font-medium mb-2">Sales vs Expenses (Today)</div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Sales {fmtCurrencyNaira(revenueToday)}</div>
          <div className="h-2 bg-secondary rounded">
            <div className="h-2 bg-success rounded" style={{ width: `${salesPct}%` }} />
          </div>
          <div className="text-xs text-muted-foreground mt-2">Expenses {fmtCurrencyNaira(expensesToday)}</div>
          <div className="h-2 bg-secondary rounded">
            <div className="h-2 bg-destructive rounded" style={{ width: `${expensesPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
