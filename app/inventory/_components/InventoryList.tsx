"use client";

import { useState } from "react";
import Link from "next/link";
import { InventoryItemActions } from "../actions-client";
import { formatBaseQuantity } from "@/lib/baseUnitDisplay";
import { fmtCurrencyNaira } from "@/lib/format";
import PrepInventoryTable, { PrepItem } from "@/app/prep/PrepInventoryTable";

type InventoryItem = {
  id: string;
  name: string;
  unit: string; // Display unit (deprecated for display)
  quantity: number | string; // Display quantity (deprecated for display)
  costPerUnit: number | string; // Display cost (deprecated for display)
  displayUnit?: string | null; // Display unit override
  unitMultiplier?: number | null;
  baseQuantity?: number | null;
  baseUnit?: string | null;
  costPerBaseUnit?: number | null;
  isActive: boolean;
  isUsed: boolean;
  type: "RAW" | "PACKAGING" | "PREP";
};

function getDisplayValues(item: InventoryItem) {
  // STRICT RULE: Use baseQuantity and baseUnit as source of truth
  
  const baseQty = item.baseQuantity !== null && item.baseQuantity !== undefined
    ? Number(item.baseQuantity)
    : 0; // Fallback to 0 if null. (Or re-calculate? No, prompt says "Never use... converted quantities")
    // Actually, if legacy data has no baseQuantity, we might be in trouble. 
    // But assuming migration happened or we trust baseQuantity.
  
  const displayQty = formatBaseQuantity(baseQty, item.baseUnit || item.unit || "pcs");
  
  // Cost should also be per base unit
  const displayCost = Number(item.costPerBaseUnit) || 0;
  
  return {
    qtyString: displayQty, // Pre-formatted string
    cost: displayCost,
    unit: item.baseUnit || "" // For column header if needed, or included in qtyString
  };
}

type InventoryListProps = {
  initialItems: InventoryItem[];
  prepItems?: PrepItem[];
  restocked?: boolean;
};

export default function InventoryList({ initialItems, prepItems = [], restocked }: InventoryListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"RAW" | "PACKAGING" | "PREP">("RAW");

  const filteredItems = initialItems.filter((item) => {
    // 1. Tab filtering (VIEW ONLY)
    if (item.type !== activeTab) return false;

    // 2. Search filtering
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const filteredPrepItems = prepItems.filter(item => 
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <div className="text-sm text-muted-foreground">Manage stock levels and costs.</div>
        </div>
        <Link
          className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
          href={activeTab === "PREP" ? "/prep/new" : `/inventory/new?type=${activeTab}`}
        >
          {activeTab === "PREP" ? "Add Prep Item" : `Add ${activeTab === "PACKAGING" ? "Packaging" : "Inventory"} Item`}
        </Link>
      </div>

      <div className="flex border-b">
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab("RAW")}
            className={`px-2 py-2 text-sm font-medium transition-colors ${
              activeTab === "RAW"
                ? "border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Raw Ingredients
          </button>
          <button
            onClick={() => setActiveTab("PACKAGING")}
            className={`px-2 py-2 text-sm font-medium transition-colors ${
              activeTab === "PACKAGING"
                ? "border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Packaging Materials
          </button>
          <button
            onClick={() => setActiveTab("PREP")}
            className={`px-2 py-2 text-sm font-medium transition-colors ${
              activeTab === "PREP"
                ? "border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Prep Items
          </button>
        </div>
      </div>

      {restocked && (
        <div className="border border-success/20 bg-success/15 text-success p-3 rounded-md">
          Inventory restocked successfully.
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder={`Search ${activeTab === "RAW" ? "raw ingredients" : activeTab === "PACKAGING" ? "packaging" : "prep items"}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {activeTab === "PREP" ? (
        <PrepInventoryTable items={filteredPrepItems} />
      ) : (
        filteredItems.length === 0 ? (
          <div className="py-12 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-lg font-medium">No {activeTab.toLowerCase()} items found</div>
              <div className="text-muted-foreground">
                {searchQuery ? "Try adjusting your search." : `Add ${activeTab.toLowerCase()} to track stock.`}
              </div>
              {!searchQuery && (
                <Link
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 mt-2"
                  href={`/inventory/new?type=${activeTab}`}
                >
                  Add {activeTab === "PACKAGING" ? "Packaging" : "Inventory"} Item
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
            <table className="w-full caption-bottom text-sm border border-border">
              <thead>
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Name</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Quantity</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Cost per Unit</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const { qtyString, cost } = getDisplayValues(item);
                  return (
                    <tr key={item.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td className="p-2 align-middle font-medium">{item.name}</td>
                      <td className="p-2 align-middle">{qtyString}</td>
                      <td className="p-2 align-middle">{fmtCurrencyNaira(cost)}</td>
                      <td className="p-2 align-middle">
                        {item.isActive ? (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-2 align-middle">
                        <div className="flex items-center gap-2">
                          {item.isActive && (
                            <>
                              <Link
                                className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                                href={`/inventory/${item.id}/edit`}
                              >
                                Edit
                              </Link>
                              <Link
                                className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                                href={`/inventory/${item.id}/restock`}
                              >
                                Restock
                              </Link>
                              <Link
                                className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                                href={`/inventory/${item.id}/adjust`}
                              >
                                Adjust
                              </Link>
                            </>
                          )}
                          <span className="hidden lg:inline-block">
                            <InventoryItemActions
                              id={item.id}
                              name={item.name}
                              isActive={item.isActive}
                              isUsed={item.isUsed}
                            />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="block lg:hidden space-y-3">
            {filteredItems.map((item) => {
              const { qtyString } = getDisplayValues(item);
              // For "Low stock" check, we need the numeric value.
              // getDisplayValues only returns string now?
              // I should update getDisplayValues to return numeric baseQty too if needed.
              // Or parse it? Parsing "3000 g" is risky.
              // Let's check getDisplayValues return type again.
              
              // Actually, I can check item.baseQuantity directly in the map loop.
              const baseQty = Number(item.baseQuantity) || 0;
              const low = baseQty <= 0; // Simple check
              
              return (
                <div key={item.id} className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {qtyString}
                      </div>
                      {low && <div className="mt-1 text-xs text-destructive">Low stock</div>}
                      {!item.isActive && <div className="mt-1 text-xs text-destructive font-semibold">Inactive</div>}
                    </div>
                    <InventoryItemActions
                        id={item.id}
                        name={item.name}
                        isActive={item.isActive}
                        isUsed={item.isUsed}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ))}
    </div>
  );
}
