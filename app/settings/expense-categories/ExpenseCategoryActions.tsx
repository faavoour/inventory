'use client';

import { useState, startTransition } from "react";
import { useConfirmAction } from "@/components/providers/ConfirmModalProvider";

type ActionState = { error?: string };

export default function ExpenseCategoryActions({
  id,
  isActive,
  usedInExpenses,
  deactivateAction,
  reactivateAction,
  deleteAction,
}: {
  id: string;
  isActive: boolean;
  usedInExpenses: boolean;
  deactivateAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  reactivateAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const { confirm } = useConfirmAction();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  async function handleDeactivate() {
    if (!(await confirm({
      title: "Deactivate Category?",
      description: "This category will no longer be selectable for new expenses. Existing expenses are unaffected.",
      confirmLabel: "Deactivate",
      isDanger: true,
    }))) {
      return;
    }
    setErrorMessage(undefined);
    setIsProcessing(true);
    startTransition(() => {});
    try {
      const fd = new FormData();
      fd.append("id", id);
      const res = await deactivateAction({}, fd);
      if (res?.error) setErrorMessage(res.error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReactivate() {
    setErrorMessage(undefined);
    setIsProcessing(true);
    startTransition(() => {});
    try {
      const fd = new FormData();
      fd.append("id", id);
      const res = await reactivateAction({}, fd);
      if (res?.error) setErrorMessage(res.error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDelete() {
    if (!(await confirm({
      title: "Delete Category?",
      description: "This category will be permanently deleted. This action cannot be undone.",
      confirmLabel: "Delete",
      isDanger: true,
    }))) {
      return;
    }
    setErrorMessage(undefined);
    setIsProcessing(true);
    startTransition(() => {});
    try {
      const fd = new FormData();
      fd.append("id", id);
      const res = await deleteAction({}, fd);
      if (res?.error) setErrorMessage(res.error);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-2">
      {isActive ? (
        <button
          type="button"
          className="px-2 py-1 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 mr-2"
          disabled={isProcessing}
          onClick={handleDeactivate}
        >
          {isProcessing ? "Updating..." : "Deactivate"}
        </button>
      ) : (
        <button
          type="button"
          className="px-2 py-1 rounded border border-border hover:bg-muted mr-2"
          disabled={isProcessing}
          onClick={handleReactivate}
        >
          {isProcessing ? "Updating..." : "Reactivate"}
        </button>
      )}
      {!usedInExpenses && (
        <button
          type="button"
          className="px-2 py-1 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={isProcessing}
          onClick={handleDelete}
        >
          {isProcessing ? "Deleting..." : "Delete"}
        </button>
      )}
      <div className="mt-1 text-xs text-muted-foreground">
        {isActive
          ? usedInExpenses
            ? "Active and in use — can be deactivated; cannot be deleted."
            : "Active — available to select on expense entry."
          : "Inactive — cannot be selected on new expenses. Reactivate anytime."}
      </div>
      {errorMessage && (
        <div className="mt-2 border border-destructive/20 bg-destructive/10 text-destructive px-2 py-1 rounded">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
