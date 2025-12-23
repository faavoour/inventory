import { db } from "@/lib/db";
import { sales } from "@/db/schema/sales";
import { expenses } from "@/db/schema/expenses";
import { paymentMethods } from "@/db/schema/paymentMethods";
import Link from "next/link";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import ExportCashFlowCsvButton from "./_components/ExportCashFlowCsvButton";
import ExportCashFlowPdfButton from "./_components/ExportCashFlowPdfButton";
import { expenseRangeFromParams, getExpensePresets } from "@/lib/dateRange";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import DatePresets from "@/components/filters/DatePresets";
import { fmtCurrencyNaira } from "@/lib/format";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const start = params?.start;
  const end = params?.end;

  const presets = getExpensePresets();
  const todayPreset = presets[0];
  const effectiveStart = start && start.length > 0 ? start : todayPreset.start;
  const effectiveEnd = end && end.length > 0 ? end : todayPreset.end;

  const { startStr, endExclusiveStr } = expenseRangeFromParams(effectiveStart, effectiveEnd);

  // 1. Get Sales by Payment Method (No category filtering)
  const salesData = await db
    .select({
      methodId: paymentAllocations.paymentMethodId,
      amount: sql<number>`sum(${paymentAllocations.amount})`,
    })
    .from(paymentAllocations)
    .innerJoin(sales, eq(paymentAllocations.entityId, sales.id))
    .where(
      and(
        eq(paymentAllocations.entityType, "SALE"),
        gte(sales.saleDate, startStr!),
        lt(sales.saleDate, endExclusiveStr!)
      )
    )
    .groupBy(paymentAllocations.paymentMethodId);

  const salesMap = new Map(salesData.map(s => [s.methodId, Number(s.amount) || 0]));

  // 2. Get Expenses by Payment Method (No category filtering)
  const expenseConditions = [
    gte(expenses.expenseDate, startStr!),
    lt(expenses.expenseDate, endExclusiveStr!),
  ];
  
  const expensesData = await db
    .select({
      methodId: expenses.paymentMethodId,
      amount: sql<number>`sum(${expenses.amount})`,
    })
    .from(expenses)
    .where(and(...expenseConditions))
    .groupBy(expenses.paymentMethodId);

  const expensesMap = new Map(expensesData.map(e => [e.methodId, Number(e.amount) || 0]));

  // 3. Get All Payment Methods
  const allMethods = await db.select().from(paymentMethods).orderBy(paymentMethods.name);

  // 4. Combine
  const rows = allMethods.map(m => {
    const s = salesMap.get(m.id) || 0;
    const e = expensesMap.get(m.id) || 0;
    return {
      name: m.name,
      sales: s,
      expenses: e,
      net: s - e
    };
  }).filter(r => r.sales !== 0 || r.expenses !== 0);

  // Totals
  const totalSales = rows.reduce((acc, r) => acc + r.sales, 0);
  const totalExpenses = rows.reduce((acc, r) => acc + r.expenses, 0);
  // const totalNet = totalSales - totalExpenses;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/reports">
            ← Back to Reports
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Cash Flow</h1>
            <div className="text-sm text-slate-500">View cash flow breakdown by payment method.</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <DatePresets presets={presets} />
          {(start || end) && (
            <div className="text-sm text-muted-foreground">
              Showing results for {start ? `${start}` : "all time"} {end ? `to ${end}` : ""}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <ExportCashFlowCsvButton rows={rows} start={start ?? ""} end={end ?? ""} disabled={rows.length === 0} />
          <ExportCashFlowPdfButton rows={rows} start={start ?? ""} end={end ?? ""} disabled={rows.length === 0} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-muted-foreground">No data for selected range</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full caption-bottom text-sm border border-border">
            <thead>
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Payment Method</th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Sales</th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Expenses</th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Net Cash Flow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const netCls =
                  r.net >= 0
                    ? "text-success"
                    : "text-destructive";
                return (
                  <tr key={r.name} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-2 align-middle font-medium">{r.name}</td>
                    <td className="p-2 align-middle">{fmtCurrencyNaira(r.sales)}</td>
                    <td className="p-2 align-middle">{fmtCurrencyNaira(r.expenses)}</td>
                    <td className={`p-2 align-middle font-bold ${netCls}`}>{fmtCurrencyNaira(r.net)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t bg-muted/50 font-medium">
              <tr>
                <td className="p-2 align-middle">Total</td>
                <td className="p-2 align-middle">{fmtCurrencyNaira(totalSales)}</td>
                <td className="p-2 align-middle">{fmtCurrencyNaira(totalExpenses)}</td>
                <td className={`p-2 align-middle font-bold ${totalSales - totalExpenses >= 0 ? "text-success" : "text-destructive"}`}>
                  {fmtCurrencyNaira(totalSales - totalExpenses)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
