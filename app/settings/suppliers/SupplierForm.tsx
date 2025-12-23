'use client';

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type ActionState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="px-3 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
      disabled={pending}
    >
      {pending ? "Saving..." : "Add Supplier"}
    </button>
  );
}

export default function SupplierForm({
  action,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4 max-w-xl">
      {state?.error && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive p-2 rounded">
          {state.error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          name="name"
          type="text"
          className="mt-1 w-full border border-input bg-background rounded-md px-2 py-1 focus:ring-2 focus:ring-ring focus:border-input outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Note (Optional)</label>
        <input
          name="note"
          type="text"
          className="mt-1 w-full border border-input bg-background rounded-md px-2 py-1 focus:ring-2 focus:ring-ring focus:border-input outline-none"
          placeholder="e.g. Primary produce supplier"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
