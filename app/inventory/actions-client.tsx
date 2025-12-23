"use client";

import { useState } from "react";
import { deactivateInventoryItem, reactivateInventoryItem, deleteInventoryItem } from "./actions";

interface InventoryItemActionsProps {
  id: string;
  name: string;
  isActive: boolean;
  isUsed: boolean;
}

export function InventoryItemActions({ id, name, isActive, isUsed }: InventoryItemActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionType, setActionType] = useState<"deactivate" | "reactivate" | "delete" | null>(null);

  const handleAction = async () => {
    try {
      if (actionType === "deactivate") {
        await deactivateInventoryItem(id);
      } else if (actionType === "reactivate") {
        await reactivateInventoryItem(id);
      } else if (actionType === "delete") {
        await deleteInventoryItem(id);
      }
    } catch (error) {
      console.error("Action failed:", error);
      alert("Action failed. Please check if the item is still in use.");
    }
    setIsOpen(false);
    setActionType(null);
  };

  const openModal = (type: "deactivate" | "reactivate" | "delete") => {
    setActionType(type);
    setIsOpen(true);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {isUsed ? (
          <>
            {isActive ? (
              <button
                onClick={() => openModal("deactivate")}
                className="text-amber-600 hover:underline text-sm font-medium"
              >
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => openModal("reactivate")}
                className="text-green-600 hover:underline text-sm font-medium"
              >
                Reactivate
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => openModal("delete")}
            className="text-red-600 hover:underline text-sm font-medium"
          >
            Delete
          </button>
        )}
      </div>
      {isUsed && (
        <span className="text-[10px] text-muted-foreground text-right max-w-[150px] leading-tight">
          Used in recipes/prep. Cannot delete.
        </span>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">
              {actionType === "deactivate" && "Deactivate Inventory Item"}
              {actionType === "reactivate" && "Reactivate Inventory Item"}
              {actionType === "delete" && "Delete Inventory Item"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {actionType === "deactivate" &&
                `Are you sure you want to deactivate "${name}"? It will be hidden from selection lists (recipes, restocking) but historical data will be preserved.`}
              {actionType === "reactivate" &&
                `Are you sure you want to reactivate "${name}"? It will become selectable again.`}
              {actionType === "delete" &&
                `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`}
            </p>
            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white shadow ${
                  actionType === "delete"
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
