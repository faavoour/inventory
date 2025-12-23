import { db } from "@/lib/db";
import { prepItems, prepInventory, prepProductionMovements, prepUsageMovements } from "@/db/schema/prep";
import { sales } from "@/db/schema/sales";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fmtCurrencyNaira } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrepItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Fetch Prep Item Details & Stock
  const [item] = await db
    .select({
      id: prepItems.id,
      name: prepItems.name,
      baseUnit: prepItems.baseUnit,
      isActive: prepItems.isActive,
      stock: prepInventory.baseQuantity,
      cost: prepInventory.costPerBaseUnit,
    })
    .from(prepItems)
    .leftJoin(prepInventory, eq(prepItems.id, prepInventory.prepItemId))
    .where(eq(prepItems.id, id))
    .limit(1);

  if (!item) notFound();

  // 2. Fetch Recent Production Movements
  const productionMoves = await db
    .select()
    .from(prepProductionMovements)
    .where(eq(prepProductionMovements.prepItemId, id))
    .orderBy(desc(prepProductionMovements.createdAt))
    .limit(10);

  // 3. Fetch Recent Usage Movements (Sales)
  const usageMoves = await db
    .select({
      id: prepUsageMovements.id,
      changeAmount: prepUsageMovements.changeAmount,
      reason: prepUsageMovements.reason,
      createdAt: prepUsageMovements.createdAt,
      saleId: prepUsageMovements.saleId,
    })
    .from(prepUsageMovements)
    .where(eq(prepUsageMovements.prepItemId, id))
    .orderBy(desc(prepUsageMovements.createdAt))
    .limit(10);

  // Combine and sort movements by date
  const allMoves = [
    ...productionMoves.map(m => ({
      id: m.id,
      type: 'PRODUCTION',
      amount: m.producedBaseQuantity,
      reason: 'Production',
      date: m.createdAt,
      link: null,
    })),
    ...usageMoves.map(m => ({
      id: m.id,
      type: 'USAGE',
      amount: m.changeAmount, // Negative value usually
      reason: m.reason,
      date: m.createdAt,
      link: m.saleId ? `/sales/${m.saleId}` : null,
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const stock = item.stock || 0;
  const cost = item.cost || 0;
  const totalValue = stock * cost;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Link href="/prep" className="text-muted-foreground hover:text-foreground">
                &larr; Back
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
            {item.isActive ? (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                    Active
                </span>
            ) : (
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
                    Inactive
                </span>
            )}
        </div>
        <div className="flex gap-2">
            <Link 
                href={`/prep/${id}/recipe`}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
                View Ingredients
            </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Current Stock</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">{Number(stock).toFixed(3)} {item.baseUnit}</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Cost per {item.baseUnit}</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">{fmtCurrencyNaira(cost)}</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Value</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">{fmtCurrencyNaira(totalValue)}</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="p-6 flex flex-col space-y-1.5">
          <h3 className="font-semibold leading-none tracking-tight">Recent Activity</h3>
          <p className="text-sm text-muted-foreground">Latest production and usage movements.</p>
        </div>
        <div className="p-6 pt-0">
            <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Reason</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Amount ({item.baseUnit})</th>
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                        {allMoves.map(move => (
                            <tr key={`${move.type}-${move.id}`} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <td className="p-4 align-middle">
                                    {formatDistanceToNow(move.date, { addSuffix: true })}
                                </td>
                                <td className="p-4 align-middle">
                                    {move.type === 'PRODUCTION' ? (
                                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-green-100 text-green-800">
                                            Production
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-blue-100 text-blue-800">
                                            Usage
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 align-middle">
                                    {move.link ? (
                                        <Link href={move.link} className="hover:underline text-primary">
                                            {move.reason}
                                        </Link>
                                    ) : (
                                        move.reason
                                    )}
                                </td>
                                <td className={`p-4 align-middle text-right font-medium ${move.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {move.amount > 0 ? '+' : ''}{Number(move.amount).toFixed(3)}
                                </td>
                            </tr>
                        ))}
                        {allMoves.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                                    No activity yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}
