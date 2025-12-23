import { db } from "@/lib/db";
import { menuItems, recipeItems } from "@/db/schema/menu";
import { inventoryItems } from "@/db/schema/inventory";
import { prepItems, prepInventory } from "@/db/schema/prep";
import { eq } from "drizzle-orm";
import Link from "next/link";
import ProductionCapacityTable, { ProductionCapacityRow, IngredientBreakdown } from "./ProductionCapacityTable";
import { formatBaseQuantity } from "@/lib/baseUnitDisplay";

export const dynamic = "force-dynamic";

export default async function Page() {
  // 1. Fetch all menu items
  const allMenuItems = await db.select().from(menuItems);

  // 2. Fetch all recipe items with their inventory details
  const allRecipeItems = await db
    .select({
      menuItemId: recipeItems.menuItemId,
      quantityRequired: recipeItems.quantityRequired,
      unit: recipeItems.unit,
      baseQuantity: recipeItems.baseQuantity,
      baseUnit: recipeItems.baseUnit,
      // Inventory
      inventoryName: inventoryItems.name,
      inventoryQuantity: inventoryItems.quantity,
      inventoryUnit: inventoryItems.unit,
      inventoryBaseQuantity: inventoryItems.baseQuantity,
      inventoryBaseUnit: inventoryItems.baseUnit,
      inventoryUnitMultiplier: inventoryItems.unitMultiplier,
      inventoryDisplayUnit: inventoryItems.displayUnit,
      // Prep
      prepName: prepItems.name,
      prepBaseQuantity: prepInventory.baseQuantity,
      prepBaseUnit: prepItems.baseUnit,
    })
    .from(recipeItems)
    .leftJoin(inventoryItems, eq(recipeItems.inventoryItemId, inventoryItems.id))
    .leftJoin(prepItems, eq(recipeItems.prepItemId, prepItems.id))
    .leftJoin(prepInventory, eq(recipeItems.prepItemId, prepInventory.prepItemId));

  // 3. Group recipes by menu item
  const recipesByMenu = new Map<string, typeof allRecipeItems>();
  for (const r of allRecipeItems) {
    const items = recipesByMenu.get(r.menuItemId) || [];
    items.push(r);
    recipesByMenu.set(r.menuItemId, items);
  }

  // 4. Calculate capacity for each menu item
  const rows: ProductionCapacityRow[] = allMenuItems.map((item) => {
    const recipes = recipesByMenu.get(item.id);

    if (!recipes || recipes.length === 0) {
      return {
        menuItemId: item.id,
        menuItemName: item.name,
        maxUnits: 0,
        limitingIngredientName: "No Recipe",
        limitingIngredientAvailable: null,
        limitingIngredientUnit: null,
        ingredients: [],
      };
    }

    // Calculate details for ALL ingredients
    const ingredientDetails = recipes.map((r) => {
      let requiredBase = 0;
      let availableBase = 0;
      let name = "";
      let availableDisplay = "";
      let inventoryQuantity = 0;
      let inventoryUnit = "";
      let requiredUnit = "";

      if (r.inventoryName) {
        // Inventory Item Logic
        name = r.inventoryName;
        // STRICT RULE: Use Base Units ONLY.
        requiredBase = Number(r.baseQuantity) || 0;
        availableBase = Number(r.inventoryBaseQuantity) || 0;
        
        // Use base quantity for "Available" display
        inventoryQuantity = availableBase;
        inventoryUnit = r.inventoryBaseUnit || "";
        requiredUnit = r.baseUnit || r.inventoryBaseUnit || "";
        
        availableDisplay = formatBaseQuantity(availableBase, inventoryUnit);

      } else if (r.prepName) {
        // Prep Item Logic
        name = r.prepName;
        // Prep items are tracked in base units
        requiredBase = Number(r.baseQuantity) || 0; // Already in base unit
        availableBase = Number(r.prepBaseQuantity) || 0; // Already in base unit
        
        inventoryQuantity = availableBase;
        inventoryUnit = r.prepBaseUnit || "";
        requiredUnit = r.baseUnit || r.prepBaseUnit || "";
        
        availableDisplay = formatBaseQuantity(availableBase, inventoryUnit);
      } else {
        return null; // Should not happen
      }

      // Skip invalid ingredients (0 required) to match previous logic
      if (requiredBase <= 0) return null;

      // Calculate max units and clamp to 0 (Prevent negative capacity)
      const rawCalc = Math.floor(availableBase / requiredBase);
      const maxUnits = Math.max(0, rawCalc);

      // Display Strings (Using Base Units)
      const reqDisplay = formatBaseQuantity(requiredBase, requiredUnit);

      return {
        name: name || "Unknown",
        requiredDisplay: reqDisplay,
        availableDisplay: availableDisplay,
        maxUnits,
        rawMaxUnits: maxUnits,
        inventoryQuantity: inventoryQuantity,
        inventoryUnit: inventoryUnit,
        isLimiting: false, // Set later
        status: "Enough" as const, // Set later
      };
    }).filter((i): i is NonNullable<typeof i> => i !== null);

    // Find limiting factor
    let minPossible = Infinity;
    if (ingredientDetails.length > 0) {
      minPossible = Math.min(...ingredientDetails.map((i) => i.rawMaxUnits));
    } else {
      minPossible = 0;
    }

    if (minPossible === Infinity) minPossible = 0;

    // Set Status & Identify Limiting Ingredient for Main Table
    let limitingName = "";
    let limitingAvailable: number | null = null;
    let limitingUnit: string | null = null;

    // We need to pick ONE limiting ingredient to show in the main table row.
    let limitingFound = false;

    const finalIngredients = ingredientDetails.map((ing) => {
      const isLimiting = ing.rawMaxUnits === minPossible;
      
      let status: "Blocking" | "Low" | "Enough" = "Enough";
      if (ing.rawMaxUnits === 0 && isLimiting) {
          status = "Blocking";
      } else if (isLimiting) {
          status = "Low";
      }

      if (isLimiting && !limitingFound) {
        limitingFound = true;
        limitingName = ing.name;
        limitingAvailable = ing.inventoryQuantity;
        limitingUnit = ing.inventoryUnit;
      }

      return {
        name: ing.name,
        requiredDisplay: ing.requiredDisplay,
        availableDisplay: ing.availableDisplay,
        maxUnits: ing.maxUnits,
        isLimiting,
        status,
      };
    });

    return {
      menuItemId: item.id,
      menuItemName: item.name,
      maxUnits: minPossible,
      limitingIngredientName: limitingName,
      limitingIngredientAvailable: limitingAvailable,
      limitingIngredientUnit: limitingUnit,
      ingredients: finalIngredients,
    };
  });

  // 5. Sort: Lowest capacity first
  rows.sort((a, b) => a.maxUnits - b.maxUnits);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/reports/menu-item-profitability">
            ← Back to Menu Item Profitability
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Menu Production Capacity</h1>
            <div className="text-sm text-slate-500">
              How many units of each menu item can be made from current inventory
            </div>
          </div>
        </div>
      </div>

      <ProductionCapacityTable rows={rows} />
    </div>
  );
}
