'use client';

import { useFormStatus } from "react-dom";
import { useConfirmAction } from "@/components/providers/ConfirmModalProvider";
import { useRef } from "react";

export default function DeleteButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const { confirm } = useConfirmAction();
  const formRef = useRef<HTMLFormElement>(null);

  function DangerButton() {
    const { pending } = useFormStatus();
    return (
      <button
        type="submit"
        disabled={pending}
        className="px-3 py-1 h-8 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        onClick={async (e) => {
          e.preventDefault();
          if (await confirm({
            title: "Delete Item?",
            description: "Delete this inventory item? This cannot be undone.",
            confirmLabel: "Delete",
            isDanger: true,
          })) {
            formRef.current?.requestSubmit();
          }
        }}
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="hidden lg:inline-block">
      <input type="hidden" name="id" value={id} />
      <DangerButton />
    </form>
  );
}
