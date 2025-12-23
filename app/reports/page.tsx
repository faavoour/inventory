import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { expenses } from "@/db/schema/expenses";
import { recurringExpenses } from "@/db/schema/recurring";
import { calculateRangeAllocatedCost } from "@/lib/recurringExpenseAllocation";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { and, eq, gte, lt, desc, sql, inArray } from "drizzle-orm";
import { expenseRangeFromParams, salesRangeFromParams, getExpensePresets } from "@/lib/dateRange";
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

  const { startDate, endExclusiveDate } = salesRangeFromParams(startStr, endStr);
  const { startStr: expenseStartStr, endExclusiveStr: expenseEndExclusiveStr } = expenseRangeFromParams(
    startStr,
    endStr
  );
  
  // Find label from presets
  const matchedPreset = presets.find(p => p.start === startStr && p.end === endStr);
  const label = matchedPreset?.label ?? `${startStr} to ${endStr}`;

  const revenueRows = await db
    .select({
      price: saleItems.totalPrice,
      createdAt: sales.createdAt,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, expenseStartStr!), lt(sales.saleDate, expenseEndExclusiveStr!)));

  const revenue = revenueRows.reduce(
    (sum, r) => sum + (Number(r.price) || 0),
    0
  );

  const movementRows = await db
    .select({
      change: inventoryMovements.changeAmount,
      createdAt: inventoryMovements.createdAt,
      reason: inventoryMovements.reason,
      costPerBaseUnit: inventoryItems.costPerBaseUnit,
    })
    .from(inventoryMovements)
    .innerJoin(
      inventoryItems,
      eq(inventoryMovements.inventoryItemId, inventoryItems.id)
    )
    .where(
      and(
        gte(inventoryMovements.createdAt, startDate!),
        lt(inventoryMovements.createdAt, endExclusiveDate!),
        sql`${inventoryMovements.type} = 'SALE' OR (${inventoryMovements.type} IS NULL AND ${inventoryMovements.changeAmount} < 0)`
      )
    );

  const cogs = movementRows.reduce((sum, m) => {
    const change = Math.abs(Number(m.change) || 0);
    const cost = Number(m.costPerBaseUnit) || 0;
    return sum + change * cost;
  }, 0);

  const grossProfit = revenue - cogs;

  const expenseRows = await db
    .select({
      amount: expenses.amount,
      date: expenses.expenseDate,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expenseDate, expenseStartStr!),
        lt(expenses.expenseDate, expenseEndExclusiveStr!)
      )
    );

  const totalVariableExpenses = expenseRows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const allRecurringExpenses = await db.select().from(recurringExpenses);
  const fixedExpensesAllocated = calculateRangeAllocatedCost(
    startDate!,
    endExclusiveDate!,
    allRecurringExpenses
  );

  const netProfit = grossProfit - totalVariableExpenses - fixedExpensesAllocated;

  // Breakdown by payment method for sales
  // ... (Wait, the rest of the file logic for payment breakdown is not shown in my previous read, but I should preserve it)
  // I need to read the rest of the file to be safe.
  
  // But wait, the previous file read stopped at line 100.
  // I should read the rest of the file before overwriting.
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reports</h1>
      </div>

      <div className="text-sm text-muted-foreground">{label}</div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
        <DatePresets presets={presets} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="text-sm text-muted-foreground">Total Revenue</div>
          <div className="text-2xl font-semibold">{formatCurrency(revenue)}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="text-sm text-muted-foreground">COGS</div>
          <div className="text-2xl font-semibold">{formatCurrency(cogs)}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="text-sm text-muted-foreground">Variable Expenses</div>
          <div className="text-2xl font-semibold">{formatCurrency(totalVariableExpenses)}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="text-sm text-muted-foreground">Fixed Expenses (Allocated)</div>
          <div className="text-2xl font-semibold">{formatCurrency(fixedExpensesAllocated)}</div>
        </div>
        <div className={`p-4 rounded-lg border shadow-sm ${netProfit >= 0 ? "border-success/20 bg-success/15 text-success" : "border-destructive/20 bg-destructive/15 text-destructive"}`}>
          <div className="text-sm">Net Profit</div>
          <div className="text-2xl font-semibold">{formatCurrency(netProfit)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/reports/inventory-valuation" className="block p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold mb-2">Inventory Valuation</h3>
          <p className="text-sm text-muted-foreground">
            View total value of current stock on hand.
          </p>
        </Link>
        <Link href="/reports/menu-item-profitability" className="block p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold mb-2">Menu Item Profitability</h3>
          <p className="text-sm text-muted-foreground">
            Analyze profit margins by menu item.
          </p>
        </Link>
        <Link href="/reports/profit-trends" className="block p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold mb-2">Profit Trends</h3>
          <p className="text-sm text-muted-foreground">
            Visualize revenue, expenses, and profit over time.
          </p>
        </Link>
        <Link href="/reports/supplier-margins" className="block p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
          <h3 className="font-semibold mb-2">Supplier Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Track spending and trends by supplier.
          </p>
        </Link>
        <Link href="/cash-flow" className="block p-6 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
           <h3 className="font-semibold mb-2">Cash Flow</h3>
           <p className="text-sm text-muted-foreground">
             View cash flow breakdown by payment method.
           </p>
         </Link>
      </div>
    </div>
  );
}
