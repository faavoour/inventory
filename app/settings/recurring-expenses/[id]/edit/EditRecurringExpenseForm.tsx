'use client';

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

type ActionState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
      disabled={pending}
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}

export default function EditRecurringExpenseForm({
  expense,
  action,
}: {
  expense: {
    id: string;
    name: string;
    amount: string;
    frequency: string;
    startDate: string;
  };
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4 max-w-xl bg-card p-4 rounded-lg border border-border">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive p-2 rounded text-sm">
          {state.error}
        </div>
      )}
      <input type="hidden" name="id" value={expense.id} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Name *</label>
          <input
            name="name"
            type="text"
            defaultValue={expense.name}
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
            defaultValue={expense.amount}
            className="mt-1 w-full border border-input bg-background rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Frequency *</label>
          <select
            name="frequency"
            defaultValue={expense.frequency}
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
            defaultValue={expense.startDate}
            className="mt-1 w-full border border-input bg-background rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <SubmitButton />
        <Link href="/settings/recurring-expenses" className="text-sm text-muted-foreground hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
