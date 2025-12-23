'use client';

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { UNITS, getUnitDefinition } from "@/lib/units";
import { normalizeNumericInput } from "@/lib/format";

type ActionState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      disabled={pending}
    >
      {pending ? "Applying..." : "Apply Adjustment"}
    </button>
  );
}

export default function AdjustForm({
  action,
  itemId,
  defaultUnit,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  itemId: string;
  defaultUnit?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [qty, setQty] = useState<string>("");
  const [unit, setUnit] = useState<string>(defaultUnit || "");

  // Filter units to show ONLY base unit if defaultUnit is provided
  // Strict rule: Base units are the ONLY units shown.
  // We effectively lock the unit to the passed defaultUnit (which should be base unit).
  const availableUnits = defaultUnit 
    ? [{ value: defaultUnit, label: defaultUnit }] 
    : UNITS;

  return (
    <form action={formAction} className="space-y-3 max-w-lg">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/15 text-destructive p-3 rounded-md text-sm">
          {state.error}
        </div>
      )}
      <input type="hidden" name="id" value={itemId} />
      <div>
        <label className="block text-sm font-medium text-foreground">Adjustment Type</label>
        <select
          name="type"
          className="mt-1 w-full border border-input bg-background rounded px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          defaultValue="add"
        >
          <option value="add">Add</option>
          <option value="remove">Remove</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">Quantity (Required)</label>
        <div className="flex gap-2 mt-1">
          <input
            name="quantity"
            type="number"
            step="any"
            min={0}
            placeholder="e.g. 5"
            className="flex-1 border border-input bg-background rounded px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
            value={qty}
            onChange={(e) => setQty(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
          />
          <select
            name="unit"
            className="w-32 border border-input bg-background rounded px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            required
          >
            <option value="" disabled>Unit</option>
            {availableUnits.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
            {!availableUnits.some(u => u.value === unit) && unit && (
               <option value={unit}>{unit}</option>
            )}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">Reason (Required)</label>
        <input
          name="reason"
          type="text"
          placeholder="e.g. Damaged pack"
          className="mt-1 w-full border border-input bg-background rounded px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          required
        />
      </div>
      <SubmitButton />
    </form>
  );
}
