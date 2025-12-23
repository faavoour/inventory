"use client";

import { useState } from "react";
import { createPrepItemAction } from "../actions";
import { useRouter } from "next/navigation";

type IngredientOption = {
  id: string;
  name: string;
  unit: string;
  baseUnit: string | null;
  costPerBaseUnit: number | null;
};

const STANDARD_UNITS = ["g", "ml", "pcs"];

export function NewPrepItemForm({ rawIngredients }: { rawIngredients: IngredientOption[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [name, setName] = useState("");
  const [yieldQty, setYieldQty] = useState("");
  const [yieldUnit, setYieldUnit] = useState("g"); // Default to 'g'

  // Removed 'unit' from row state as it's derived from the ingredient
  const [rows, setRows] = useState([
    { id: crypto.randomUUID(), inventoryItemId: "", quantity: "" }
  ]);

  const addRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), inventoryItemId: "", quantity: "" }]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: string, value: any) => {
    setRows(rows.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const ingredients = rows.map(r => ({
        inventoryItemId: r.inventoryItemId,
        quantity: parseFloat(r.quantity),
        // unit is implicitly handled by server based on inventory item
      }));

      // Basic validation
      if (!name || !yieldQty || !yieldUnit) throw new Error("Please fill all prep item details");
      if (ingredients.some(i => !i.inventoryItemId || isNaN(i.quantity))) throw new Error("Invalid ingredients");

      await createPrepItemAction({
        name,
        yieldQuantity: parseFloat(yieldQty),
        yieldUnit,
        ingredients
      });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-card p-6 rounded-lg border">
      {error && <div className="text-red-500">{error}</div>}

      <div className="space-y-4">
        <h3 className="font-medium border-b pb-2">1. Prep Item Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              className="w-full p-2 border rounded bg-background"
              placeholder="e.g. Tomato Sauce"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Yield Quantity</label>
            <input
              type="number"
              step="any"
              className="w-full p-2 border rounded bg-background"
              placeholder="e.g. 5"
              value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Yield Unit</label>
            <select
              className="w-full p-2 border rounded bg-background"
              value={yieldUnit}
              onChange={(e) => setYieldUnit(e.target.value)}
              required
            >
              {STANDARD_UNITS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
           <h3 className="font-medium">2. Raw Ingredients Used</h3>
           <button type="button" onClick={addRow} className="text-sm text-primary hover:underline">+ Add Ingredient</button>
        </div>
        
        <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                <div className="col-span-6">Ingredient</div>
                <div className="col-span-3">Quantity</div>
                <div className="col-span-2">Unit</div>
                <div className="col-span-1"></div>
            </div>

          {rows.map((row) => {
             const selectedItem = rawIngredients.find(i => i.id === row.inventoryItemId);
             return (
            <div key={row.id} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-6">
                <select
                  className="w-full p-2 border rounded bg-background"
                  value={row.inventoryItemId}
                  onChange={(e) => updateRow(row.id, "inventoryItemId", e.target.value)}
                  required
                >
                  <option value="">Select...</option>
                  {rawIngredients.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  step="any"
                  className="w-full p-2 border rounded bg-background"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
              <div className="col-span-2 flex items-center h-full">
                <span className="text-sm text-muted-foreground px-2">
                  {selectedItem?.unit || "-"}
                </span>
              </div>
              <div className="col-span-1 flex justify-center pt-2">
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-700">
                    ✕
                  </button>
                )}
              </div>
            </div>
          )})}
        </div>
      </div>

      <div className="pt-4 border-t">
        <button
          type="submit"
          disabled={loading}
          className="w-full md:w-auto px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create & Produce Batch"}
        </button>
      </div>
    </form>
  );
}
