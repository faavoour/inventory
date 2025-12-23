import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { menuItems } from "@/db/schema/menu";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import { desc, eq, inArray, gte, lt, and } from "drizzle-orm";
import ExportCsvButton from "./_components/ExportCsvButton";
import ExportPdfButton from "./_components/ExportPdfButton";
import { salesRangeFromParams, getExpensePresets } from "@/lib/dateRange";
import { fmtCurrencyNaira } from "@/lib/format";
import DatePresets from "@/components/filters/DatePresets";
import SalesTable from "./_components/SalesTable";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; deleted?: string; start?: string; end?: string; methodId?: string }>;
}) {
  const params = await searchParams;
  const start = params?.start;
  const end = params?.end;
  const updated = params?.updated;
  const deleted = params?.deleted;
  const methodId = params?.methodId;

  const presets = getExpensePresets();
  const todayPreset = presets[0];
  const effectiveStart = start && start.length > 0 ? start : todayPreset.start;
  const effectiveEnd = end && end.length > 0 ? end : todayPreset.end;
  
  const { startDate, endExclusiveDate } = salesRangeFromParams(effectiveStart, effectiveEnd);

  // Date filtering conditions
  const condStart = startDate ? gte(sales.saleDate, startDate.toISOString()) : null;
  const condEnd = endExclusiveDate ? lt(sales.saleDate, endExclusiveDate.toISOString()) : null;
  
  let finalWhere: ReturnType<typeof and> | ReturnType<typeof eq> | ReturnType<typeof inArray> | null = null;
  if (condStart && condEnd) {
    finalWhere = and(condStart, condEnd);
  } else if (condStart || condEnd) {
    finalWhere = (condStart ?? condEnd)!;
  }

  // Payment Method filtering
  if (methodId && methodId !== "All") {
    const matchingSales = db
      .select({ id: paymentAllocations.entityId })
      .from(paymentAllocations)
      .where(and(eq(paymentAllocations.entityType, "SALE"), eq(paymentAllocations.paymentMethodId, methodId)));
    
    if (finalWhere) {
      finalWhere = and(finalWhere, inArray(sales.id, matchingSales));
    } else {
      finalWhere = inArray(sales.id, matchingSales);
    }
  }

  // Fetch sales for date range
  const rows = await (
    finalWhere
      ? db.select().from(sales).where(finalWhere)
      : db.select().from(sales)
  ).orderBy(desc(sales.saleDate));

  const methods = await db.select().from(paymentMethods);
  const nameById = new Map(methods.map((m) => [m.id, m.name]));
  
  const saleIds = rows.map((r) => r.id);
  const saleAllocs = saleIds.length
    ? await db
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "SALE"), inArray(paymentAllocations.entityId, saleIds)))
    : [];

  const saleIdsForItems = rows.map((r) => r.id).filter(Boolean) as string[];
  const itemRows =
    saleIdsForItems.length > 0
      ? await db
          .select({ saleId: saleItems.saleId, name: menuItems.name })
          .from(saleItems)
          .innerJoin(menuItems, eq(saleItems.menuItemId, menuItems.id))
          .where(inArray(saleItems.saleId, saleIdsForItems))
      : [];

  const itemsBySaleId = new Map<string, string[]>();
  for (const it of itemRows) {
    const arr = itemsBySaleId.get(it.saleId) ?? [];
    arr.push(it.name ?? "");
    itemsBySaleId.set(it.saleId, arr);
  }

  const allocsBySaleId = new Map<string, Array<{ methodName: string; amount: number }>>();
  for (const a of saleAllocs) {
    const arr = allocsBySaleId.get(a.entityId) ?? [];
    arr.push({ methodName: nameById.get(a.paymentMethodId) ?? "—", amount: Number(a.amount) || 0 });
    allocsBySaleId.set(a.entityId, arr);
  }

  const salesForTable = rows.map((s) => {
    const allocs = allocsBySaleId.get(s.id) ?? [];
    const pmText =
      allocs.length === 0
        ? "—"
        : allocs.length === 1
        ? allocs[0].methodName
        : allocs.map((a) => `${a.methodName} (${fmtCurrencyNaira(a.amount)})`).join(" + ");
    
    return {
      id: s.id,
      createdAt: new Date(`${String(s.saleDate)}`), // Ensure Date object
      totalAmount: Number(s.totalAmount) || 0,
      paymentMethodName: pmText,
      items: itemsBySaleId.get(s.id) ?? [],
      allocations: allocs,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sales</h1>
          <div className="text-sm text-muted-foreground">
            Manage your sales records.
          </div>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          href="/sales/new"
        >
          New Sale
        </Link>
      </div>
      
      {updated && (
        <div className="rounded-md border border-success/20 bg-success/15 p-3 text-sm text-success">
          Sale updated successfully.
        </div>
      )}
      {deleted && (
        <div className="rounded-md border border-success/20 bg-success/15 p-3 text-sm text-success">
          Sale deleted successfully.
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <DatePresets presets={presets} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ExportCsvButton rows={salesForTable.map(r => ({
            dateISO: r.createdAt.toISOString(),
            paymentMethod: r.paymentMethodName,
            amount: r.totalAmount,
            items: r.items
          }))} />
          <ExportPdfButton rows={salesForTable.map(r => ({
            dateISO: r.createdAt.toISOString(),
            paymentMethod: r.paymentMethodName,
            amount: r.totalAmount,
            items: r.items
          }))} />
        </div>
      </div>

      <SalesTable 
        rows={salesForTable} 
        paymentMethods={methods} 
        currentMethodId={methodId || "All"} 
      />
    </div>
  );
}
