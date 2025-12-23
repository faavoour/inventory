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
      {pending ? "Saving..." : "Add Expense Category"}
    </button>
  );
}

export default function ExpenseCategoryForm({
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
          <div className="mt-1 text-xs text-foreground">
            Please check the category name and try again.
          </div>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">Category Name *</label>
        <input
          name="name"
          type="text"
          placeholder="e.g. Utilities, Transportation, Staff Welfare"
          className="mt-1 w-full border border-input bg-background rounded-md px-4 py-2 lg:px-2 lg:py-1 focus:ring-2 focus:ring-ring focus:border-input outline-none"
          required
        />
        <div className="mt-1 text-xs text-muted-foreground">
          Used to organize and filter expenses. Choose a clear, descriptive name.
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
