'use client';

import { useFormStatus } from "react-dom";
import { useConfirmAction } from "@/components/providers/ConfirmModalProvider";

function DangerButton({ children, onClick }: { children: React.ReactNode; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={pending}
      className="px-3 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {pending ? "Resetting..." : children}
    </button>
  );
}

export default function ResetAction({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const { confirm } = useConfirmAction();

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const form = e.currentTarget.form;
    
    // Safety check - although button is always in form in this architecture
    if (!form) {
      console.error("ResetAction button must be inside a form");
      return;
    }

    const confirmed = await confirm({
      title: "Confirm Reset",
      description: "You are about to permanently delete this data set. This action cannot be reversed.",
      confirmLabel: "Reset",
      isDanger: true,
    });

    if (confirmed) {
      form.requestSubmit();
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card text-card-foreground p-4 shadow-sm">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-1">{description}</div>
      </div>
      <div>
        <button
          onClick={handleClick}
          className="lg:hidden inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
        >
          Reset
        </button>
        <div className="hidden lg:block">
          <DangerButton onClick={handleClick}>Reset</DangerButton>
        </div>
      </div>
    </div>
  );
}
