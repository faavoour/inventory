'use client';

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type ActionState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
      disabled={pending}
    >
      {pending ? "Saving..." : "Add Recurring Expense"}
    </button>
  );
}

export default function RecurringExpenseForm({
  action,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4 max-w-xl bg-card p-4 rounded-lg border border-border">
      <h2 className="font-semibold text-lg">Add New Recurring Expense</h2>
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive p-2 rounded text-sm">
          {state.error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Name *</label>
          <input
            name="name"
            type="text"
            placeholder="e.g. Shop Rent"
            className="mt-1 w-full border border-input bg-background rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Amount (₦) *</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            className="mt-1 w-full border border-input bg-background rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Frequency *</label>
          <select
            name="frequency"
            className="mt-1 w-full border border-input bg-background rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            required
          >
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Start Date *</label>
          <input
            name="startDate"
            type="date"
            className="mt-1 w-full border border-input bg-background rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Recurring expenses are allocated daily and do not create daily expense records.
      </div>
      <SubmitButton />
    </form>
  );
}
