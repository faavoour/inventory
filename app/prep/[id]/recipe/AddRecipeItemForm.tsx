'use client';

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

type ActionState = { error?: string };
type InventoryItem = { 
  id: string; 
  name: string; 
  unit: string | null; 
  baseUnit: string | null; 
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      disabled={pending}
    >
      {pending ? "Adding..." : "Add Ingredient"}
    </button>
  );
}

export default function AddRecipeItemForm({
  action,
  inventoryItems,
  prepItemId,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  inventoryItems: InventoryItem[];
  prepItemId: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [selectedInvId, setSelectedInvId] = useState<string>("");

  const selectedInv = inventoryItems.find(i => i.id === selectedInvId);
  // Display the unit the user is familiar with (Display Unit), or Base Unit if no Display Unit
  const unitDisplay = selectedInv?.unit || selectedInv?.baseUnit || "";

  return (
    <form action={formAction} className="space-y-3 max-w-lg mt-8 border-t pt-8">
      <h3 className="text-lg font-medium">Add Ingredient</h3>
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/15 text-destructive p-3 rounded-md text-sm">
          {state.error}
        </div>
      )}
      <input type="hidden" name="prepItemId" value={prepItemId} />
      <div>
        <label className="block text-sm font-medium">Ingredient</label>
        <select
          name="inventoryItemId"
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          required
          value={selectedInvId}
          onChange={(e) => setSelectedInvId(e.target.value)}
        >
          <option value="">Select an ingredient</option>
          {inventoryItems.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name} ({opt.unit || opt.baseUnit})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Quantity Required</label>
        <div className="flex gap-2 mt-1 items-center">
          <input
            name="quantity"
            type="number"
            step="any"
            min={0}
            className="flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            required
          />
          <div className="w-32 px-3 py-1 text-sm font-medium text-muted-foreground bg-muted rounded-md border border-transparent text-center">
            {unitDisplay || "Unit"}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Enter quantity in {unitDisplay || "units"}. System will convert to base unit automatically.
        </p>
      </div>
      <SubmitButton />
    </form>
  );
}
