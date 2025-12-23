'use client';

import { useState, startTransition } from "react";
import { useConfirmAction } from "@/components/providers/ConfirmModalProvider";

type ActionState = { error?: string };

export default function SupplierActions({
  id,
  isActive,
  usedInMovements,
  deactivateAction,
  reactivateAction,
  deleteAction,
}: {
  id: string;
  isActive: boolean;
  usedInMovements: boolean;
  deactivateAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  reactivateAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  deleteAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const { confirm } = useConfirmAction();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  async function handleDeactivate() {
    if (!(await confirm({
      title: "Deactivate Supplier?",
      description: "This supplier will no longer be selectable for new inventory actions. Existing records are unaffected.",
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
      title: "Delete Supplier?",
      description: "This supplier will be permanently deleted. This action cannot be undone.",
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
      {!usedInMovements && (
        <button
          type="button"
          className="px-2 py-1 rounded border border-destructive/50 text-destructive hover:bg-destructive/10"
          disabled={isProcessing}
          onClick={handleDelete}
        >
          {isProcessing ? "Deleting..." : "Delete"}
        </button>
      )}
      <div className="mt-1 text-xs text-muted-foreground">
        {isActive
          ? usedInMovements
            ? "This supplier is used in restocks. You can deactivate it to prevent future use."
            : "This supplier is active and can be selected for restocks."
          : "This supplier is inactive and cannot be selected for new restocks."}
      </div>
      {errorMessage && (
        <div className="mt-2 border border-destructive/20 bg-destructive/10 text-destructive px-2 py-1 rounded">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
