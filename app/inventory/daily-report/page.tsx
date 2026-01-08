import { db } from "@/lib/db";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { and, gte, lte, eq, asc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

// Helpers for date handling
function getDayBounds(dateStr: string) {
  // Parse YYYY-MM-DD in local time (or consistent time)
  // We assume the user wants 00:00 to 23:59 of that calendar date
  const start = new Date(dateStr + "T00:00:00");
  const end = new Date(dateStr + "T23:59:59.999");
  
  // Next day start for "after" calculation
  const nextDayStart = new Date(start);
  nextDayStart.setDate(nextDayStart.getDate() + 1);
  
  return { start, end, nextDayStart };
}

import ReportFilter from "./ReportFilter";

export default async function DailyInventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const todayStr = new Date().toISOString().split("T")[0];
  const selectedDate = params.date || todayStr;
  
  const { start, end, nextDayStart } = getDayBounds(selectedDate);

  // 1. Fetch Inventory Items
  const items = await db.select().from(inventoryItems).orderBy(asc(inventoryItems.name));

  // 2. Fetch All Movements from Start of Selected Day onwards
  // We need movements during the day AND after the day to calculate back from Current
  const movements = await db
    .select()
    .from(inventoryMovements)
    .where(gte(inventoryMovements.createdAt, start));

  // 3. Process Data
  const reportData = items.map((item) => {
    const itemMovements = movements.filter((m) => m.inventoryItemId === item.id);
    
    // Split movements
    const movementsAfterDay = itemMovements.filter((m) => m.createdAt >= nextDayStart);
    const movementsDuringDay = itemMovements.filter(
      (m) => m.createdAt >= start && m.createdAt < nextDayStart
    );

    // Calculate Base Quantities
    // Current Base Quantity in DB
    const currentBaseQty = item.baseQuantity !== null 
      ? Number(item.baseQuantity) 
      : Number(item.quantity) * (Number(item.unitMultiplier) || 1);

    // Opening Stock = Current - (MovementsAfter + MovementsDuring)
    // Actually: Current is state NOW.
    // State at End of Day = Current - MovementsAfter
    // State at Start of Day = State at End of Day - MovementsDuring
    
    const netChangeAfter = movementsAfterDay.reduce((sum, m) => sum + m.changeAmount, 0);
    const closingStockBase = currentBaseQty - netChangeAfter;
    
    const netChangeDuring = movementsDuringDay.reduce((sum, m) => sum + m.changeAmount, 0);
    const openingStockBase = closingStockBase - netChangeDuring;

    // Group "During" movements
    let receivedBase = 0;
    let usedBase = 0;
    let adjustmentsBase = 0;

    for (const m of movementsDuringDay) {
      if (m.type === "SALE" || m.type === "PREP_CONSUMPTION" || m.type === "SALE_REVERSAL") {
        // Sales are negative, Reversals positive. 
        // "Used" should be the net consumption.
        // If net is negative (consumption), we show it as positive Usage.
        // If net is positive (returns > sales), it's weird for "Used", but we'll track net.
        usedBase += m.changeAmount; 
      } else if (m.type === "ADJUSTMENT") {
        if (m.changeAmount > 0) {
           // Positive Adjustment -> Received / Restock
           receivedBase += m.changeAmount;
        } else {
           // Negative Adjustment -> Adjustment (Waste/Shrinkage)
           adjustmentsBase += m.changeAmount;
        }
      }
    }

    // Convert "Used" to positive number for display if it's negative (consumption)
    // If it's positive (net returns), we keep it negative? 
    // Usually "Used" column expects positive value for consumption.
    // changeAmount for SALE is negative.
    // So usedBase will be negative.
    // We want to display: Opening + Received - Used + Adjustments = Closing
    // So if Used is displayed as positive 5 (meaning -5 change), formula works.
    
    const usedDisplay = -usedBase; // Flip sign for display

    return {
      id: item.id,
      name: item.name,
      baseUnit: item.baseUnit || item.unit,
      opening: openingStockBase,
      received: receivedBase,
      used: usedDisplay,
      adjustments: adjustmentsBase,
      closing: closingStockBase,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Inventory Report</h1>
          <p className="text-muted-foreground">
            Track opening and closing stock, usage, and deliveries per day.
          </p>
        </div>
        <ReportFilter defaultDate={selectedDate} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground font-medium border-b">
              <tr>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3 text-right">Opening</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3 text-right">Adjustments</th>
                <th className="px-4 py-3 text-right">Closing</th>
                <th className="px-4 py-3">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reportData.map((row) => (
                <tr key={row.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {row.opening.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">
                    {row.received > 0 ? "+" : ""}
                    {row.received.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-orange-600">
                    {row.used.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    {row.adjustments !== 0 ? (
                        <>
                        {row.adjustments > 0 ? "+" : ""}
                        {row.adjustments.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {row.closing.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.baseUnit}</td>
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No inventory items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground mt-4">
        <p>* <strong>Received</strong> includes Restocks and positive Adjustments.</p>
        <p>* <strong>Adjustments</strong> includes Waste, Spoilage, and negative corrections.</p>
        <p>* <strong>Used</strong> includes Sales and Prep Consumption.</p>
      </div>
    </div>
  );
}
