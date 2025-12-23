'use client';

import { useRef } from "react";
import { useConfirmAction } from "@/components/providers/ConfirmModalProvider";

export default function RemoveRecipeItemButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const { confirm } = useConfirmAction();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="hidden lg:inline-block">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="px-2 py-1 rounded-md border border-destructive/20 text-destructive hover:bg-destructive/10 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={async (e) => {
          e.preventDefault();
          if (
            await confirm({
              title: "Remove Recipe Item?",
              description: "Remove this item from the recipe? This cannot be undone.",
              confirmLabel: "Remove",
              isDanger: true,
            })
          ) {
            formRef.current?.requestSubmit();
          }
        }}
      >
        Remove
      </button>
    </form>
  );
}
