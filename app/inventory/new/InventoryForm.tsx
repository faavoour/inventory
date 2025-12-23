'use client';

import { useActionState } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { normalizeNumericInput, fmtCurrencyNaira } from "@/lib/format";
import { UNITS } from "@/lib/units";

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

export default function InventoryForm({
  action,
  type = "RAW",
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  type?: "RAW" | "PACKAGING";
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [qty, setQty] = useState<string>("");
  const [totalCost, setTotalCost] = useState<string>("");

  return (
    <form action={formAction} className="space-y-3 max-w-lg">
      <input type="hidden" name="type" value={type} />
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive p-2 rounded">
          {state.error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">Name (Required)</label>
        <input
          name="name"
          type="text"
          placeholder="e.g. Tomatoes"
          className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Unit (Required)</label>
        {type === "PACKAGING" ? (
          <>
            <input type="hidden" name="unit" value="pcs" />
            <div className="mt-1 w-full border border-input bg-muted text-muted-foreground rounded px-4 py-2 lg:px-2 lg:py-1">
              Pieces (pcs)
            </div>
          </>
        ) : (
          <select
            name="unit"
            className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select a unit...
            </option>
            <optgroup label="Weight">
              {UNITS.filter((u) => u.category === "WEIGHT" && u.value === "g").map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Volume">
              {UNITS.filter((u) => u.category === "VOLUME" && u.value === "ml").map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Count">
              {UNITS.filter((u) => u.category === "COUNT" && u.value === "pcs").map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </optgroup>
          </select>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium">Quantity (Required)</label>
        <input
          name="quantity"
          type="number"
          step="any"
          min={0}
          placeholder="e.g. 20"
          className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
          value={qty}
          onChange={(e) => setQty(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
          required
        />
        <div className="text-xs text-muted-foreground mt-1">Starting stock on hand.</div>
      </div>
      <div>
        <label className="block text-sm font-medium">Total Purchase Cost (Required)</label>
        <input
          name="totalPurchaseCost"
          type="number"
          step="any"
          min={0}
          placeholder="e.g. 1500"
          className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
          value={totalCost}
          onChange={(e) => setTotalCost(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
          required
        />
        <div className="text-xs text-muted-foreground mt-1">
          Cost per unit will be calculated automatically
        </div>
        {Number(qty) > 0 && totalCost !== "" && (
          <div className="mt-1">
            <div className="text-sm text-foreground">
              Calculated cost per unit:{" "}
              <span className="font-medium">
                {fmtCurrencyNaira(Number(totalCost) / Number(qty))}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Automatically calculated</div>
          </div>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
