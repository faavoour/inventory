'use client';

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { UNITS, getUnitDefinition } from "@/lib/units";

type ActionState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
      disabled={pending}
    >
      {pending ? "Saving..." : "Save"}
    </button>
  );
}

export default function EditInventoryForm({
  current,
  action,
}: {
  current: { id: string; name: string; unit: string; quantity: number; costPerUnit: number };
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  const currentUnitDef = getUnitDefinition(current.unit);
  // Strict Rule: Base units are the ONLY units shown.
  // We assume current.unit is already a base unit (passed from server).
  // We restrict selection to only this unit to prevent confusion/conversion issues.
  const availableUnits = currentUnitDef
    ? [{ value: current.unit, label: current.unit }]
    : UNITS;

  return (
    <div className="space-y-4">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive p-2 rounded">
          {state.error}
        </div>
      )}
      <form action={formAction} className="space-y-3 max-w-lg">
        <input type="hidden" name="id" value={current.id} />
        <div>
          <label className="block text-sm font-medium">Name (Required)</label>
          <input
            name="name"
            type="text"
            className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
            defaultValue={current.name}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Unit (Required)</label>
          <select
            name="unit"
            className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150"
            defaultValue={current.unit}
            required
          >
            {availableUnits.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
            {!availableUnits.some(u => u.value === current.unit) && (
               <option value={current.unit}>{current.unit}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Quantity (Read-only)</label>
          <input
            name="quantity"
            type="number"
            className="mt-1 w-full border border-input bg-muted text-muted-foreground rounded px-4 py-2 lg:px-2 lg:py-1"
            value={current.quantity}
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Cost per Unit (Read-only)</label>
          <input
            name="costPerUnit"
            type="number"
            step="any"
            min={0}
            placeholder="e.g. 150"
            className="mt-1 w-full border border-input bg-muted text-muted-foreground rounded px-4 py-2 lg:px-2 lg:py-1"
            value={current.costPerUnit}
            readOnly
          />
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}
