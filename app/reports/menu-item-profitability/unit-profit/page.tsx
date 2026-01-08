import { db } from "@/lib/db";
import { menuItems, recipeItems } from "@/db/schema/menu";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { fmtCurrencyNaira } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  // 1. Fetch all menu items
  const allMenuItems = await db.select().from(menuItems);

  // 2. Fetch unit costs (reusing existing logic from menu-item-profitability page)
  const unitCosts = await db
    .select({
      menuItemId: recipeItems.menuItemId,
      unitCost: sql<number>`sum(
        CASE 
          WHEN ${recipeItems.sourceType} = 'PREP' THEN
             COALESCE(${recipeItems.baseQuantity}, 0) * COALESCE(prep_inventory.cost_per_base_unit, 0)
          WHEN ${recipeItems.sourceType} IN ('RAW', 'PACKAGING') THEN
             CASE
               WHEN ${recipeItems.baseQuantity} IS NOT NULL AND inventory_items.cost_per_base_unit IS NOT NULL 
               THEN ${recipeItems.baseQuantity} * inventory_items.cost_per_base_unit
               ELSE ${recipeItems.quantityRequired} * inventory_items.cost_per_unit
             END
          ELSE 0
        END
      )`,
    })
    .from(recipeItems)
    .leftJoin(sql`inventory_items`, eq(recipeItems.inventoryItemId, sql.raw("inventory_items.id")))
    .leftJoin(sql`prep_items`, eq(recipeItems.prepItemId, sql.raw("prep_items.id")))
    .leftJoin(sql`prep_inventory`, eq(recipeItems.prepItemId, sql.raw("prep_inventory.prep_item_id")))
    .groupBy(recipeItems.menuItemId);

  const unitCostMap = new Map<string, number>(
    unitCosts.map((r) => [r.menuItemId as string, Number(r.unitCost) || 0])
  );

  // 3. Combine and calculate
  const rows = allMenuItems.map((item) => {
    const hasRecipe = unitCostMap.has(item.id);
    const unitCost = unitCostMap.get(item.id) || 0;
    const price = Number(item.price) || 0;

    let cogsDisplay = "—";
    let profitDisplay = "—";
    let marginDisplay = "—";
    let profitValue = -Infinity; // For sorting

    if (hasRecipe) {
      cogsDisplay = fmtCurrencyNaira(unitCost);
      const profit = price - unitCost;
      profitDisplay = fmtCurrencyNaira(profit);
      profitValue = profit;

      const margin = price > 0 ? (profit / price) * 100 : 0;
      marginDisplay = `${Math.round(margin)}%`;
    }

    return {
      id: item.id,
      name: item.name,
      price: price,
      cogsDisplay,
      profitDisplay,
      marginDisplay,
      profitValue,
    };
  });

  // Sort by Unit Profit (descending)
  rows.sort((a, b) => b.profitValue - a.profitValue);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/reports/menu-item-profitability">
            ← Back to Menu Item Profitability
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Menu Item Unit Profit</h1>
            <div className="text-sm text-slate-500">
              Profit per menu item based on current cost and pricing
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 transition-colors hover:bg-muted/50">
              <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                Menu Item
              </th>
              <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                Price
              </th>
              <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                Unit COGS
              </th>
              <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                Unit Profit
              </th>
              <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
                Profit Margin (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border transition-colors hover:bg-muted/50"
              >
                <td className="p-4 align-middle">{r.name}</td>
                <td className="p-4 align-middle text-right">
                  {fmtCurrencyNaira(r.price)}
                </td>
                <td className="p-4 align-middle text-right">{r.cogsDisplay}</td>
                <td
                  className={`p-4 align-middle text-right ${
                    r.profitValue >= 0
                      ? "text-green-600 dark:text-green-400"
                      : r.profitValue === -Infinity
                      ? ""
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {r.profitDisplay}
                </td>
                <td className="p-4 align-middle text-right">
                  {r.marginDisplay}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
