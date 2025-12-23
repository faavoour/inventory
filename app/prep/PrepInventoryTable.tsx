'use client';

import { useState } from "react";
import Link from "next/link";
import { formatBaseQuantity } from "@/lib/baseUnitDisplay";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PrepItemActions } from "./PrepItemActions";
import React from "react";

export type PrepRecipeItem = {
  inventoryItemName: string;
  inventoryItemUnit: string;
  requiredQuantity: number;
  cost: number;
};

export type PrepItem = {
  id: string;
  name: string;
  baseUnit: string;
  isActive: boolean;
  stock: number;
  cost: number;
  usageCount: number;
  recipe: PrepRecipeItem[];
};

export default function PrepInventoryTable({ items }: { items: PrepItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="border rounded-lg">
      <table className="w-full caption-bottom text-sm">
        <thead className="[&_tr]:border-b">
          <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Base Unit</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">In Stock</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cost / Unit</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Total Value</th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {items.map((item) => {
            const displayQty = formatBaseQuantity(item.stock, item.baseUnit);
            const totalValue = (item.stock || 0) * (item.cost || 0);
            const isExpanded = expandedId === item.id;

            return (
              <React.Fragment key={item.id}>
                <tr 
                  onClick={() => toggleRow(item.id)}
                  className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted cursor-pointer ${
                    !item.isActive ? "opacity-60 bg-muted/20" : ""
                  } ${isExpanded ? "bg-muted/50" : ""}`}
                >
                  <td className="p-4 align-middle font-medium">
                    <div className="hover:underline font-semibold text-foreground">
                      {item.name}
                    </div>
                  </td>
                  <td className="p-4 align-middle">
                    {item.isActive ? (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-500 text-white shadow hover:bg-green-600">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-gray-500 text-white shadow hover:bg-gray-600">Inactive</span>
                    )}
                  </td>
                  <td className="p-4 align-middle">{item.baseUnit}</td>
                  <td className="p-4 align-middle">
                    {displayQty}
                  </td>
                  <td className="p-4 align-middle">
                    {item.cost ? formatCurrency(item.cost) : "-"}
                  </td>
                  <td className="p-4 align-middle">
                    {formatCurrency(totalValue)}
                  </td>
                  <td className="p-4 align-middle" onClick={(e) => e.stopPropagation()}>
                    <PrepItemActions 
                      id={item.id} 
                      isActive={item.isActive} 
                      usageCount={item.usageCount} 
                    />
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-muted/20">
                    <td colSpan={7} className="p-0">
                      <div className="p-4 border-b border-border">
                        <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Recipe Ingredients</h4>
                        {item.recipe.length > 0 ? (
                          <div className="rounded-md border bg-background">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="py-2 px-4 text-left font-medium text-muted-foreground">Ingredient</th>
                                  <th className="py-2 px-4 text-right font-medium text-muted-foreground">Quantity Required</th>
                                  <th className="py-2 px-4 text-right font-medium text-muted-foreground">Cost Contribution</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.recipe.map((ingredient, idx) => (
                                  <tr key={idx} className="border-b last:border-0">
                                    <td className="py-2 px-4">{ingredient.inventoryItemName}</td>
                                    <td className="py-2 px-4 text-right">
                                      {formatNumber(ingredient.requiredQuantity)} {ingredient.inventoryItemUnit}
                                    </td>
                                    <td className="py-2 px-4 text-right">
                                      {formatCurrency(ingredient.cost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">No recipe ingredients defined.</div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
