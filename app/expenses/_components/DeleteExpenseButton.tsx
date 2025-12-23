'use client';

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useConfirmAction } from "@/components/providers/ConfirmModalProvider";

type ActionState = { error?: string };

function DangerButton({ children, onClick }: { children: React.ReactNode, onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="hidden lg:inline-block ml-2 px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}

export default function DeleteExpenseButton({
  id,
  action,
}: {
  id: string;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const { confirm } = useConfirmAction();
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  const handleClick = async () => {
    if (await confirm({
      title: "Delete Expense?",
      description: "Deleting this expense will update financial reports. This action cannot be undone.",
      confirmLabel: "Delete Expense",
      isDanger: true,
    })) {
      formRef.current?.requestSubmit();
    }
  };

  return (
    <>
      <form ref={formRef} action={formAction} className="inline">
        <input type="hidden" name="id" value={id} />
        <DangerButton onClick={handleClick}>Delete</DangerButton>
      </form>
      {state?.error && (
        <div className="fixed bottom-4 right-4 z-50 border border-destructive/20 bg-destructive/15 text-destructive p-3 rounded-md text-sm shadow-lg animate-in fade-in slide-in-from-bottom-5">
          {state.error}
        </div>
      )}
    </>
  );
}
