'use client';

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { normalizeNumericInput, fmtCurrencyNaira } from "@/lib/format";

type ActionState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      disabled={pending}
    >
      {pending ? "Restocking..." : "Restock"}
    </button>
  );
}

export default function RestockForm({
  action,
  itemId,
  suppliers,
  baseUnit,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  itemId: string;
  suppliers?: Array<{ id: string; name: string }>;
  baseUnit: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  
  const [qty, setQty] = useState<string>("");
  const [total, setTotal] = useState<string>("");
  
  const unitCost =
    Number(qty) > 0 && Number(total) > 0 ? Number(total) / Number(qty) : 0;

  return (
    <form action={formAction} className="space-y-3 max-w-lg">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/15 text-destructive p-3 rounded-md text-sm">
          {state.error}
        </div>
      )}
      <input type="hidden" name="id" value={itemId} />
      <div>
        <label className="block text-sm font-medium text-foreground">Quantity to add (Required)</label>
        <div className="flex gap-2 mt-1 items-center">
          <input
            name="quantity"
            type="number"
            step="any"
            min={0}
            placeholder="e.g. 10"
            className="flex-1 border border-input bg-background rounded px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={qty}
            onChange={(e) => setQty(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
            required
          />
          <span className="text-sm font-medium bg-muted px-3 py-2 rounded border border-input min-w-[80px] text-center">
            {baseUnit}
          </span>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">Total purchase price (Required)</label>
        <input
          name="totalPrice"
          type="number"
          step="any"
          min={0}
          placeholder="e.g. 15000"
          className="mt-1 w-full border border-input bg-background rounded px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={total}
          onChange={(e) => setTotal(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
          required
        />
        <div className="text-xs text-muted-foreground mt-1">
          Cost per unit will be calculated automatically.
        </div>
        {Number(qty) > 0 && Number(total) > 0 && (
          <div className="mt-1">
            <div className="text-sm text-foreground">
              Cost per unit:{" "}
              <span className="font-medium">{fmtCurrencyNaira(unitCost)}</span>
            </div>
            <div className="text-xs text-muted-foreground">Automatically calculated</div>
          </div>
        )}
      </div>
      {suppliers && suppliers.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground">Supplier (optional)</label>
          <select name="supplierId" className="mt-1 w-full border border-input bg-background rounded px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" defaultValue="">
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-foreground">Note (Optional)</label>
        <input
          name="note"
          type="text"
          placeholder="e.g. Supplier delivery"
          className="mt-1 w-full border border-input bg-background rounded px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div>
        <SubmitButton />
        <Link
          href="/inventory"
          className="hidden lg:inline-block ml-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
