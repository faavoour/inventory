'use client';

import { useState, useTransition } from "react";
import Link from "next/link";
import { useConfirmAction } from "@/components/providers/ConfirmModalProvider";

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
  const { confirm } = useConfirmAction();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const handleAction = async (action: (prevState: ActionState, formData: FormData) => Promise<ActionState>) => {
    setError(undefined);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", id);
      const res = await action({}, formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  const handleDelete = async () => {
    if (await confirm({
      title: "Delete Recurring Expense?",
      description: "This recurring expense will be permanently removed. This action cannot be undone.",
      confirmLabel: "Delete",
      isDanger: true,
    })) {
      await handleAction(onDelete);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/settings/recurring-expenses/${id}/edit`}
        className="px-2 py-1 hover:bg-muted rounded border border-border"
      >
        Edit
      </Link>
      
      {isActive ? (
        <button
          onClick={() => handleAction(onDeactivate)}
          disabled={isPending}
          className="px-2 py-1 hover:bg-warning/20 text-warning border border-warning/20 rounded disabled:opacity-50"
        >
          {isPending ? "..." : "Deactivate"}
        </button>
      ) : (
        <button
          onClick={() => handleAction(onReactivate)}
          disabled={isPending}
          className="px-2 py-1 hover:bg-success/20 text-success border border-success/20 rounded disabled:opacity-50"
        >
          {isPending ? "..." : "Reactivate"}
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={isPending}
        className="px-2 py-1 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded disabled:opacity-50"
      >
        {isPending ? "..." : "Delete"}
      </button>
      
      {error && (
          <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
