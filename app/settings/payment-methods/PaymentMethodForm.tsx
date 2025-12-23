'use client';

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type ActionState = { error?: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="hidden lg:inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
      disabled={pending}
    >
      {pending ? "Saving..." : "Add Payment Method"}
    </button>
  );
}

export default function PaymentMethodForm({
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
        <label className="block text-sm font-medium">Name (Required)</label>
        <input
          name="name"
          type="text"
          placeholder="e.g. Cash"
          className="mt-1 w-full border border-input bg-background rounded-md px-4 py-2 lg:px-2 lg:py-1 focus:ring-2 focus:ring-ring focus:border-input outline-none"
          required
        />
        <div className="text-xs text-muted-foreground mt-1">Shown in payment method selection.</div>
      </div>
      <SubmitButton />
    </form>
  );
}
