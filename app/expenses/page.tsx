import { db } from "@/lib/db";
import { expenses } from "@/db/schema/expenses";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { expenseCategories } from "@/db/schema/expenseCategories";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import { and, desc, eq, gte, lt, inArray } from "drizzle-orm";
import ExportExpensesCsvButton from "./_components/ExportExpensesCsvButton";
import ExportExpensesPdfButton from "./_components/ExportExpensesPdfButton";
import { expenseRangeFromParams, getExpensePresets } from "@/lib/dateRange";
import DatePresets from "@/components/filters/DatePresets";
import ExpensesTable from "./_components/ExpensesTable";
import Link from "next/link";
import { fmtCurrencyNaira } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; deleted?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const start = params?.start;
  const end = params?.end;
  const updated = params?.updated;
  const deleted = params?.deleted;

  const presets = getExpensePresets();
  const todayPreset = presets[0];
  const effectiveStart = start && start.length > 0 ? start : todayPreset.start;
  const effectiveEnd = end && end.length > 0 ? end : todayPreset.end;
  
  const { startStr, endExclusiveStr } = expenseRangeFromParams(effectiveStart, effectiveEnd);
  
  const condStart = startStr ? gte(expenses.expenseDate, startStr) : null;
  const condEnd = endExclusiveStr ? lt(expenses.expenseDate, endExclusiveStr) : null;

  let finalWhere: ReturnType<typeof and> | ReturnType<typeof eq> | null = null;
  if (condStart && condEnd) {
    finalWhere = and(condStart, condEnd);
  } else if (condStart || condEnd) {
    finalWhere = (condStart ?? condEnd)!;
  }

  // Fetch all expenses for date range (no category/payment filtering in DB)
  const rows = await (
    finalWhere
      ? db.select().from(expenses).where(finalWhere)
      : db.select().from(expenses)
  ).orderBy(desc(expenses.expenseDate));

  const expenseIds = rows.map((r) => r.id);
  const allocs = expenseIds.length
    ? await db
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "EXPENSE"), inArray(paymentAllocations.entityId, expenseIds)))
    : [];

  const methods = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true)).orderBy(paymentMethods.name);
  const nameById = new Map(methods.map((m) => [m.id, m.name]));

  let categories: Array<{ id: string; name: string; isActive: boolean }> = [];
  let categoryNameById = new Map<string, string>();
  try {
    const cats = await db.select().from(expenseCategories).orderBy(expenseCategories.name);
    categories = cats.map((c) => ({ id: c.id, name: c.name, isActive: !!c.isActive }));
    categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  } catch {
    categories = [];
    categoryNameById = new Map();
  }

  const allocsByExpenseId = new Map<string, Array<{ methodId: string; methodName: string; amount: number }>>();
  for (const a of allocs) {
    const arr = allocsByExpenseId.get(a.entityId) ?? [];
    arr.push({ 
      methodId: a.paymentMethodId, 
      methodName: nameById.get(a.paymentMethodId) ?? "—", 
      amount: Number(a.amount) || 0 
    });
    allocsByExpenseId.set(a.entityId, arr);
  }

  const rowsForTable = rows.map((e) => {
    const allocList = allocsByExpenseId.get(e.id) ?? [];
    const pmText =
      allocList.length === 0
        ? "—"
        : allocList.length === 1
        ? allocList[0].methodName
        : allocList.map((a) => `${a.methodName} (${fmtCurrencyNaira(a.amount)})`).join(" + ");
    
    return {
      id: e.id,
      dateStr: String(e.expenseDate),
      category: e.expenseCategoryId ? categoryNameById.get(e.expenseCategoryId) ?? "—" : (e.category ?? ""),
      title: e.title ?? "",
      amount: Number(e.amount) || 0,
      paymentMethod: pmText,
      allocations: allocList,
      expenseCategoryId: e.expenseCategoryId,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <div className="text-sm text-muted-foreground">Track expenses and their payment methods.</div>
        </div>
        <Link
          className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          href="/expenses/new"
        >
          Add Expense
        </Link>
      </div>
      {updated && (
        <div className="rounded-md border border-success/20 bg-success/15 p-3 text-sm text-success">
          Expense updated successfully.
        </div>
      )}
      {deleted && (
        <div className="rounded-md border border-success/20 bg-success/15 p-3 text-sm text-success">
          Expense deleted successfully.
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <DatePresets presets={presets} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ExportExpensesCsvButton rows={rowsForTable} />
          <ExportExpensesPdfButton rows={rowsForTable} />
        </div>
      </div>

      <ExpensesTable 
        rows={rowsForTable} 
        paymentMethods={methods.map(m => ({ id: m.id, name: m.name }))}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
