'use client';

import { useState } from "react";
import { formatNumber } from "@/lib/format";

export type IngredientBreakdown = {
  name: string;
  requiredDisplay: string;
  availableDisplay: string;
  maxUnits: number;
  isLimiting: boolean;
  status: "Blocking" | "Low" | "Enough";
};

export type ProductionCapacityRow = {
  menuItemId: string;
  menuItemName: string;
  maxUnits: number;
  limitingIngredientName: string | null;
  limitingIngredientAvailable: number | null;
  limitingIngredientUnit: string | null;
  ingredients: IngredientBreakdown[];
};

export default function ProductionCapacityTable({
  rows,
}: {
  rows: ProductionCapacityRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 transition-colors hover:bg-muted/50">
            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
              Menu Item Name
            </th>
            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
              Max Units Possible
            </th>
            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
              Limiting Ingredient
            </th>
            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
              Avail. Ingredient Units
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-4 text-center text-muted-foreground">
                No menu items found.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const isExpanded = expandedId === r.menuItemId;
              return (
                <>
                  <tr
                    key={r.menuItemId}
                    onClick={() => toggleRow(r.menuItemId)}
                    className={`border-b border-border transition-colors hover:bg-muted/50 cursor-pointer ${
                      isExpanded ? "bg-muted/50" : ""
                    }`}
                  >
                    <td className="p-4 align-middle font-medium">
                      {r.menuItemName}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <span
                        className={`font-bold ${
                          r.maxUnits === 0
                            ? "text-destructive"
                            : r.maxUnits < 10
                            ? "text-warning"
                            : "text-success"
                        }`}
                      >
                        {formatNumber(r.maxUnits)}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      {r.limitingIngredientName || "—"}
                    </td>
                    <td className="p-4 align-middle text-right">
                      {r.limitingIngredientAvailable !== null
                        ? `${formatNumber(r.limitingIngredientAvailable)} ${r.limitingIngredientUnit}`
                        : "—"}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-muted/20">
                      <td colSpan={4} className="p-0">
                        <div className="p-4 border-b border-border">
                          <h4 className="mb-2 font-semibold text-sm">
                            Ingredients for {r.menuItemName}
                          </h4>
                          {r.ingredients.length === 0 ? (
                            <p className="text-muted-foreground italic">
                              No ingredients linked to this menu item.
                            </p>
                          ) : (
                            <div className="rounded-md border border-border bg-background overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/50 border-b border-border">
                                    <th className="p-2 text-left font-medium">Ingredient Name</th>
                                    <th className="p-2 text-right font-medium">Required (Unit)</th>
                                    <th className="p-2 text-right font-medium">Available (Unit)</th>
                                    <th className="p-2 text-right font-medium">Max Units</th>
                                    <th className="p-2 text-center font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.ingredients.map((ing, idx) => (
                                    <tr
                                      key={idx}
                                      className={`border-b border-border last:border-0 ${
                                        ing.isLimiting ? "bg-warning/10" : ""
                                      }`}
                                    >
                                      <td className={`p-2 ${ing.isLimiting ? "font-bold" : ""}`}>
                                        {ing.name}
                                        {ing.isLimiting && (
                                          <div className="text-[10px] font-normal text-muted-foreground">
                                            Limits production to {formatNumber(ing.maxUnits)} units.
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-2 text-right">{ing.requiredDisplay}</td>
                                      <td className="p-2 text-right">{ing.availableDisplay}</td>
                                      <td className="p-2 text-right font-medium">
                                        {formatNumber(ing.maxUnits)}
                                      </td>
                                      <td className="p-2 text-center">
                                        {ing.status === "Blocking" && "❌"}
                                        {ing.status === "Low" && "⚠️"}
                                        {ing.status === "Enough" && "✅"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
