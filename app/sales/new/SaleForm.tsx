'use client';

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useMemo, useState } from "react";
import { normalizeNumericInput, fmtCurrencyNaira } from "@/lib/format";

type ActionState = {
  error?: string;
  insufficient?: Array<{ name: string; required: number; available: number; unit?: string }>;
};
type MenuItem = { id: string; name: string; price: number };
type PaymentMethod = { id: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={pending}
      >
        {pending ? "Saving..." : "Record Sale"}
      </button>

      {/* Mobile Submit Button */}
      <div className="lg:hidden">
        <button
          type="submit"
          className="w-full px-4 py-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
          disabled={pending}
        >
          {pending ? "Saving..." : "Record Sale"}
        </button>
      </div>
    </>
  );
}

export default function SaleForm({
  action,
  menuItems,
  paymentMethods,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  menuItems: MenuItem[];
  paymentMethods: PaymentMethod[];
}) {
  const [rows, setRows] = useState<Array<{ itemId: string; quantity: string }>>(
    [{ itemId: "", quantity: "" }]
  );
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [mode, setMode] = useState<"single" | "split">("single");
  const [pmA, setPmA] = useState<string>("");
  const [pmB, setPmB] = useState<string>("");
  const [amtA, setAmtA] = useState<string>("");
  const [amtB, setAmtB] = useState<string>("");
  const todayStr = useMemo(() => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }, []);

  const priceById = useMemo(
    () => Object.fromEntries(menuItems.map((m) => [m.id, m.price])),
    [menuItems]
  );

  const total = rows.reduce((sum, r) => {
    const p = priceById[r.itemId] ?? 0;
    const q = Number(r.quantity) || 0;
    return sum + p * q;
  }, 0);

  return (
    <form action={formAction} className="space-y-4 max-w-2xl">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/15 text-destructive p-2 rounded">
          {state.error}
        </div>
      )}
      {state?.insufficient && state.insufficient.length > 0 && (
        <div className="border border-warning/20 bg-warning/15 text-warning p-2 rounded text-sm">
          <div className="font-medium">Missing / Insufficient Ingredients</div>
          <div className="mt-1 space-y-1">
            {state.insufficient.map((it, idx) => (
              <div key={idx}>
                • {it.name} — required: {it.required} {it.unit ?? ""}, available: {it.available} {it.unit ?? ""}
              </div>
            ))}
          </div>
        </div>
      )}

      

      <div>
        <h3 className="text-sm font-medium">Details</h3>
        <div className="text-xs text-muted-foreground mt-1">Select menu items and quantities.</div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Sale Date (Required)</label>
            <input
              name="saleDate"
              type="date"
              defaultValue={todayStr}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
          </div>
        </div>
        <div className="mt-2 space-y-3">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-7">
                <label className="block text-sm font-medium">Menu Item (Required)</label>
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={row.itemId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], itemId: v };
                      return next;
                    });
                  }}
                  required
                >
                  <option value="">Select item</option>
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium">Quantity (Required)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 2"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={row.quantity}
                  onChange={(e) => {
                    const v = normalizeNumericInput(e.target.value, { allowDecimal: false });
                    setRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], quantity: v };
                      return next;
                    });
                  }}
                  required
                />
              </div>
              <div className="md:col-span-2 hidden lg:flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                  onClick={() =>
                    setRows((prev) => [
                      ...prev,
                      { itemId: "", quantity: "" },
                    ])
                  }
                >
                  Add
                </button>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-destructive text-destructive bg-background shadow-sm hover:bg-destructive/10 h-9 px-4 py-2"
                    onClick={() =>
                      setRows((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
 
              <input type="hidden" name="itemId" value={row.itemId} />
              <input type="hidden" name="quantity" value={row.quantity} />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 mt-4">
        <h3 className="text-sm font-medium mb-2">Amounts</h3>
        <div className="text-lg">Total: <span className="font-semibold">{total}</span></div>
        <div className="text-xs text-slate-500 mt-1">Total updates as items change.</div>
      </div>

      <div className="border-t border-slate-200 pt-4 mt-4">
        <h3 className="text-sm font-medium mb-2">Payment Details</h3>
        <div className="space-y-2">
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
                setAmtA(String(total));
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
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={pmA}
              onChange={(e) => setPmA(e.target.value)}
              required
            >
              <option value="">Select method</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="mt-2 text-sm text-muted-foreground">
              Amount: <span className="font-medium">{total}</span>
            </div>
            <input type="hidden" name="allocA_method" value={pmA} />
              <input type="hidden" name="allocA_amount" value={total} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Payment Method A (Required)</label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={pmA}
                onChange={(e) => setPmA(e.target.value)}
                required
              >
                <option value="">Select method</option>
                {paymentMethods.map((m) => (
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
                placeholder="e.g. 10,000"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={amtA}
                onChange={(e) => setAmtA(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
                required
              />
              <input type="hidden" name="allocA_method" value={pmA} />
              <input type="hidden" name="allocA_amount" value={amtA} />
            </div>
            <div>
              <label className="block text-sm font-medium">Payment Method B (Required)</label>
              <select
                className="mt-1 w-full border rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                value={pmB}
                onChange={(e) => setPmB(e.target.value)}
                required
              >
                <option value="">Select method</option>
                {paymentMethods.map((m) => (
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
                placeholder="e.g. 10,000"
                className="mt-1 w-full border rounded px-4 py-2 lg:px-2 lg:py-1 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                value={amtB}
                onChange={(e) => setAmtB(normalizeNumericInput(e.target.value, { allowDecimal: true }))}
                required
              />
              <input type="hidden" name="allocB_method" value={pmB} />
              <input type="hidden" name="allocB_amount" value={amtB} />
            </div>
            {(() => {
              const splitSum = Number(amtA) + Number(amtB);
              const diff = Math.round(Number(total)) - Math.round(splitSum);
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
              <div className="col-span-2 border border-destructive/20 bg-destructive/15 text-destructive p-2 rounded text-sm">
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
