"use client";

import { useState } from "react";
import Link from "next/link";
import { deletePrepItemAction, togglePrepItemStatusAction } from "./actions";
import { useConfirmAction } from "@/components/providers/ConfirmModalProvider";

type PrepItemActionsProps = {
  id: string;
  isActive: boolean;
  usageCount: number;
};

export function PrepItemActions({ id, isActive, usageCount }: PrepItemActionsProps) {
  const [loading, setLoading] = useState(false);
  const { confirm } = useConfirmAction();

  const handleDelete = async () => {
    if (await confirm({
      title: "Delete Prep Item?",
      description: "This prep item will be permanently deleted. This action cannot be undone.",
      confirmLabel: "Delete",
      isDanger: true,
    })) {
      setLoading(true);
      try {
        await deletePrepItemAction(id);
      } catch (e: any) {
        alert(e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleStatus = async () => {
    const action = isActive ? "deactivate" : "reactivate";
    if (await confirm({
      title: `${isActive ? "Deactivate" : "Reactivate"} Prep Item?`,
      description: `Are you sure you want to ${action} this prep item?`,
      confirmLabel: isActive ? "Deactivate" : "Reactivate",
      isDanger: isActive,
    })) {
      setLoading(true);
      try {
        await togglePrepItemStatusAction(id, !isActive);
      } catch (e: any) {
        alert(e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) return <span className="text-muted-foreground">Processing...</span>;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-3">
        <Link 
          href={`/prep/${id}/add-batch`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Add Batch
        </Link>
        
        <span className="text-muted-foreground/30">|</span>

        {usageCount > 0 ? (
          <button
            onClick={handleToggleStatus}
            className={`text-sm hover:underline ${isActive ? "text-orange-600" : "text-green-600"}`}
          >
            {isActive ? "Deactivate" : "Reactivate"}
          </button>
        ) : (
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 hover:underline"
          >
            Delete
          </button>
        )}
      </div>
      
      {usageCount > 0 && (
        <span className="text-xs text-muted-foreground">
          Used in {usageCount} menu items
        </span>
      )}
    </div>
  );
}
