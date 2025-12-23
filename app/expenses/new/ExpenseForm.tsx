'use client';

import { useActionState, useState, useMemo } from "react";
import { useFormStatus } from "react-dom";
import { normalizeNumericInput } from "@/lib/format";
import { fmtCurrencyNaira } from "@/lib/format";

type ActionState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring"
      disabled={pending}
    >
      {pending ? "Saving..." : "Create Expense"}
    </button>
  );
}

export default function ExpenseForm({
  action,
  paymentMethods,
  expenseCategories,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  paymentMethods?: { id: string; name: string }[];
  expenseCategories?: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [mode, setMode] = useState<"single" | "split">("single");
  const [pmA, setPmA] = useState<string>("");
  const [pmB, setPmB] = useState<string>("");
  const [amtA, setAmtA] = useState<string>("");
  const [amtB, setAmtB] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const todayStr = useMemo(() => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }, []);

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive p-2 rounded text-sm">
          {state.error}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium">Details</h3>
        <div className="text-xs text-muted-foreground mt-1">Provide basic information.</div>
        <div className="mt-2 space-y-3">
          <div>
            <label className="block text-sm font-medium">Title (Required)</label>
            <input
              name="title"
              type="text"
              placeholder="e.g. Generator fuel"
              className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Expense Category (Optional)</label>
            <select
              name="expenseCategoryId"
              className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150"
              defaultValue=""
            >
              <option value="">None</option>
              {(expenseCategories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-sm font-medium mb-2">Amounts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Amount (Required)</label>
            <input
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              placeholder="e.g. 10,000"
              className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150 placeholder:text-muted-foreground"
              value={amount}
              onChange={(e) => {
                const v = normalizeNumericInput(e.target.value, { allowDecimal: true });
                setAmount(v);
                if (mode === "single") setAmtA(v);
              }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Expense Date (Required)</label>
            <input
              name="expenseDate"
              type="date"
              defaultValue={todayStr}
              className="mt-1 w-full border border-input bg-background rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors duration-150"
              required
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2">Amount must be greater than 0.</div>
      </div>

      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-sm font-medium mb-2">Payment</h3>
        <div className="text-xs text-muted-foreground mb-2">Choose single or split payment.</div>
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
                  setAmtA(amount);
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
                  setAmtA("");
                  setAmtB("");
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
            >
              <option value="">Select method</option>
              {(paymentMethods ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="mt-2 text-sm text-muted-foreground">
              Amount: <span className="font-medium">{amount}</span>
            </div>
            <input type="hidden" name="allocA_method" value={pmA} />
            <input type="hidden" name="allocA_amount" value={amount} />
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
              const diff = Math.round(Number(amount)) - Math.round(splitSum);
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

      <SubmitButton />
    </form>
  );
}
