"use client";

import { useState } from "react";
import { addPrepBatchAction } from "@/app/prep/actions";
import Link from "next/link";

type RecipeItem = {
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemUnit: string;
  baseQuantity: number;
};

type PrepItem = {
  id: string;
  name: string;
  baseUnit: string;
};

export default function AddBatchForm({ prepItem, recipe }: { prepItem: PrepItem, recipe: RecipeItem[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batchYield, setBatchYield] = useState<string>(""); // Start empty or with default? Maybe empty forces user to check.
  
  // Initialize ingredients with recipe defaults
  const [ingredients, setIngredients] = useState(
    recipe.map(r => ({
      inventoryItemId: r.inventoryItemId,
      name: r.inventoryItemName,
      unit: r.inventoryItemUnit,
      quantity: r.baseQuantity.toString()
    }))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
        const yieldNum = Number(batchYield);
        if (isNaN(yieldNum) || yieldNum <= 0) throw new Error("Batch yield must be greater than 0");
        
        const validIngredients = ingredients.map(i => {
            const qty = Number(i.quantity);
            if (isNaN(qty) || qty <= 0) throw new Error(`Quantity for ${i.name} must be greater than 0`);
            return {
                inventoryItemId: i.inventoryItemId,
                quantity: qty
            };
        });

        await addPrepBatchAction(
            prepItem.id,
            yieldNum,
            validIngredients
        );
    } catch (err: any) {
        setError(err.message);
        setLoading(false);
    }
  };

  const handleIngredientChange = (index: number, val: string) => {
      const newIngredients = [...ingredients];
      newIngredients[index].quantity = val;
      setIngredients(newIngredients);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-card p-6 rounded-lg border">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">Batch Output</h2>
        <div className="grid gap-4 max-w-sm">
          <div className="grid gap-2">
            <label htmlFor="yield" className="text-sm font-medium">
              Total Yield Produced
            </label>
            <div className="flex items-center gap-2">
              <input
                id="yield"
                type="number"
                step="any"
                min="0"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={batchYield}
                onChange={(e) => setBatchYield(e.target.value)}
                placeholder={`e.g. 100`}
              />
              <span className="text-sm font-medium text-muted-foreground w-16">
                {prepItem.baseUnit}
              </span>
            </div>
            <p className="text-[0.8rem] text-muted-foreground">
              The total amount of {prepItem.name} produced in this batch.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">Ingredients Used</h2>
        <div className="grid gap-4">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground px-1">
                <div className="col-span-6">Ingredient</div>
                <div className="col-span-6">Quantity Used</div>
            </div>
            
            {ingredients.map((ing, idx) => (
                <div key={ing.inventoryItemId} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-6">
                        <span className="text-sm font-medium">{ing.name}</span>
                    </div>
                    <div className="col-span-6 flex items-center gap-2">
                        <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={ing.quantity}
                            onChange={(e) => handleIngredientChange(idx, e.target.value)}
                        />
                        <span className="text-sm text-muted-foreground w-16">
                            {ing.unit}
                        </span>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 pt-4 border-t">
        <Link
            href="/prep"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
            Cancel
        </Link>
        <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
        >
            {loading ? "Recording Batch..." : "Record Batch"}
        </button>
      </div>
    </form>
  );
}
