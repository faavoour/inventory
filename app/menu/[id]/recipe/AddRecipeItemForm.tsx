'use client';

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

type ActionState = { error?: string };
type ItemOption = { id: string; name: string; unit: string; costPerUnit: number; type: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      disabled={pending}
    >
      {pending ? "Adding..." : "Add to Recipe"}
    </button>
  );
}

export default function AddRecipeItemForm({
  action,
  inventory,
  menuItemId,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  inventory: ItemOption[];
  menuItemId: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [sourceType, setSourceType] = useState<string>("RAW");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  const filteredItems = inventory.filter(i => {
    if (sourceType === 'RAW') return i.type === 'RAW' || i.type === 'inventory';
    if (sourceType === 'PACKAGING') return i.type === 'PACKAGING';
    if (sourceType === 'PREP') return i.type === 'PREP' || i.type === 'prep';
    return false;
  });

  const selectedItem = inventory.find(i => i.id === selectedItemId);
  const unitDisplay = selectedItem?.unit || "";

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/15 text-destructive p-3 rounded-md text-sm">
          {state.error}
        </div>
      )}
      <input type="hidden" name="menuId" value={menuItemId} />
      <input type="hidden" name="sourceType" value={sourceType} />
      
      <div>
        <label className="block text-sm font-medium mb-2">Source Type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input 
              type="radio" 
              name="sourceTypeSelector" 
              value="RAW" 
              checked={sourceType === 'RAW'} 
              onChange={(e) => { setSourceType(e.target.value); setSelectedItemId(""); }}
              className="accent-primary"
            />
            <span className="text-sm">Raw Ingredient</span>
          </label>
          <label className="flex items-center gap-2">
            <input 
              type="radio" 
              name="sourceTypeSelector" 
              value="PACKAGING" 
              checked={sourceType === 'PACKAGING'} 
              onChange={(e) => { setSourceType(e.target.value); setSelectedItemId(""); }}
              className="accent-primary"
            />
            <span className="text-sm">Packaging</span>
          </label>
          <label className="flex items-center gap-2">
            <input 
              type="radio" 
              name="sourceTypeSelector" 
              value="PREP" 
              checked={sourceType === 'PREP'} 
              onChange={(e) => { setSourceType(e.target.value); setSelectedItemId(""); }}
              className="accent-primary"
            />
            <span className="text-sm">Prep Item</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Item</label>
        <select
          name="itemId"
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          required
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
        >
          <option value="">Select an item</option>
          {filteredItems.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name} ({opt.unit})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Quantity Required</label>
        <div className="flex gap-2 mt-1 items-center">
          <input
            name="quantityRequired"
            type="number"
            step="any"
            min={0}
            className="flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            required
          />
          <div className="w-32 px-3 py-1 text-sm font-medium text-muted-foreground bg-muted rounded-md border border-transparent">
            {unitDisplay || "Unit"}
          </div>
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
