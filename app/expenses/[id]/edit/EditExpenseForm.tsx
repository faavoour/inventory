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
      className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring"
      disabled={pending}
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}

export default function EditExpenseForm({
  current,
  action,
  paymentMethods,
  expenseCategories,
  allocations,
}: {
  current: { id: string; title: string; category: string; amount: number; expenseDate: string; paymentMethodId?: string | null; expenseCategoryId?: string | null };
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  paymentMethods?: { id: string; name: string }[];
  expenseCategories?: { id: string; name: string }[];
  allocations?: { paymentMethodId: string; amount: number }[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const allocs = allocations ?? [];
  const defaultMode: "single" | "split" = allocs.length === 2 ? "split" : "single";
  const [mode, setMode] = useState<"single" | "split">(defaultMode);
  const [pmA, setPmA] = useState<string>(allocs[0]?.paymentMethodId ?? "");
  const [pmB, setPmB] = useState<string>(allocs[1]?.paymentMethodId ?? "");
  const [amtA, setAmtA] = useState<string>(
    allocs[0]?.amount !== undefined ? String(allocs[0]?.amount) : String(current.amount)
  );
  const [amtB, setAmtB] = useState<string>(
    allocs[1]?.amount !== undefined ? String(allocs[1]?.amount) : ""
  );

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive p-2 rounded text-sm">
          {state.error}
        </div>
      )}
      <input type="hidden" name="id" value={current.id} />
      <div>
        <label className="block text-sm font-medium">Amount (Required)</label>
        <input
          name="amount"
          type="number"
          step="any"
          min={0}
          placeholder="e.g. 10,000"
          className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
          defaultValue={current.amount}
          required
        />
        <div className="text-xs text-muted-foreground mt-1">Amount must be greater than 0.</div>
      </div>
      <div>
        <label className="block text-sm font-medium">Expense Category (Optional)</label>
        <select
          name="expenseCategoryId"
          className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150"
          defaultValue={current.expenseCategoryId ?? ""}
        >
          <option value="">None</option>
          {(expenseCategories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Description (Required)</label>
        <input
          name="title"
          type="text"
          placeholder="e.g. Replacement bulbs"
          className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
          defaultValue={current.title}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Date (Required)</label>
        <input
          name="expenseDate"
          type="date"
          className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150"
          defaultValue={current.expenseDate}
          required
        />
      </div>
      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-sm font-medium mb-2">Payment</h3>
        <div className="space-y-2">
          <div className="text-sm font-medium">Payment Mode</div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="allocMode"
                value="single"
                checked={mode === "single"}
                onChange={() => {
                  setMode("single");
                  setPmB("");
                  setAmtB("");
                  setAmtA(String(current.amount));
                }}
              />
              <span>Single payment</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="allocMode"
                value="split"
                checked={mode === "split"}
                onChange={() => {
                  setMode("split");
                }}
              />
              <span>Split payment</span>
            </label>
          </div>
        {mode === "single" ? (
          <div>
            <label className="block text-sm font-medium">Payment Method (Required)</label>
            <select
              className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150"
              value={pmA}
              onChange={(e) => setPmA(e.target.value)}
              required
            >
              <option value="">Select method</option>
              {(paymentMethods ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input type="hidden" name="allocA_method" value={pmA} />
            <input type="hidden" name="allocA_amount" value={current.amount} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Payment Method A (Required)</label>
              <select
                className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150"
                value={pmA}
                onChange={(e) => setPmA(e.target.value)}
              >
                <option value="">Select method</option>
                {(paymentMethods ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <label className="block text-sm font-medium mt-2">Amount A (Required)</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                placeholder="e.g. 7,500"
                className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
                value={amtA}
                onChange={(e) => setAmtA(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
              />
              <input type="hidden" name="allocA_method" value={pmA} />
              <input type="hidden" name="allocA_amount" value={amtA} />
            </div>
            <div>
              <label className="block text-sm font-medium">Payment Method B (Required)</label>
              <select
                className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150"
                value={pmB}
                onChange={(e) => setPmB(e.target.value)}
              >
                <option value="">Select method</option>
                {(paymentMethods ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <label className="block text-sm font-medium mt-2">Amount B (Required)</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                placeholder="e.g. 2,500"
                className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
                value={amtB}
                onChange={(e) => setAmtB(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
              />
              <input type="hidden" name="allocB_method" value={pmB} />
              <input type="hidden" name="allocB_amount" value={amtB} />
            </div>
              {(() => {
                const splitSum = Number(amtA) + Number(amtB);
                const diff = Math.round(Number(current.amount)) - Math.round(splitSum);
                if (diff === 0) {
                  return <p className="col-span-2 text-sm text-success">Balanced</p>;
                }
                if (diff > 0) {
                  return (
                    <p className="col-span-2 text-sm text-destructive">
                      {`Payment mismatch: ${fmtCurrencyNaira(Math.abs(diff))} remaining`}
                    </p>
                  );
                }
                return (
                  <p className="col-span-2 text-sm text-warning">
                    {`Payment exceeds total by ${fmtCurrencyNaira(Math.abs(diff))}`}
                  </p>
                );
              })()}
              {pmA && pmB && pmA === pmB && (
                <div className="col-span-2 border border-destructive/20 bg-destructive/10 text-destructive p-2 rounded text-sm">
                  Cannot select the same payment method twice.
                </div>
              )}
              <input type="hidden" name="allocMode" value="split" />
            </div>
          )}
          {mode === "single" && <input type="hidden" name="allocMode" value="single" />}
        </div>
      </div>
      <div>
        <SubmitButton />
        <Link href="/expenses" className="hidden lg:inline-block ml-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring">
          Cancel
        </Link>
      </div>
    </form>
  );
}
