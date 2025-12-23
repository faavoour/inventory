'use client';

import { useActionState } from "react";
import Link from "next/link";

type ActionState = { error?: string };

export default function RecurringExpenseActions({
  id,
  isActive,
  onDeactivate,
  onReactivate,
  onDelete,
}: {
  id: string;
  isActive: boolean;
  onDeactivate: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  onReactivate: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  onDelete: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [deleteState, deleteAction] = useActionState(onDelete, {});
  const [deactivateState, deactivateAction] = useActionState(onDeactivate, {});
  const [reactivateState, reactivateAction] = useActionState(onReactivate, {});

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/settings/recurring-expenses/${id}/edit`}
        className="px-2 py-1 hover:bg-muted rounded border border-border"
      >
        Edit
      </Link>
      
      {isActive ? (
        <form action={deactivateAction}>
            <input type="hidden" name="id" value={id} />
            <button
                type="submit"
                className="px-2 py-1 hover:bg-warning/20 text-warning border border-warning/20 rounded"
            >
                Deactivate
            </button>
        </form>
      ) : (
        <form action={reactivateAction}>
            <input type="hidden" name="id" value={id} />
            <button
                type="submit"
                className="px-2 py-1 hover:bg-success/20 text-success border border-success/20 rounded"
            >
                Reactivate
            </button>
        </form>
      )}

      <form action={deleteAction} onSubmit={(e) => !confirm("Are you sure? This cannot be undone.") && e.preventDefault()}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="px-2 py-1 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded"
        >
          Delete
        </button>
      </form>
      {(deleteState?.error || deactivateState?.error || reactivateState?.error) && (
          <span className="text-xs text-destructive">Error</span>
      )}
    </div>
  );
}
