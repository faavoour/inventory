"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export default function ReportFilter({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate);

  function handleChange(newDate: string) {
    setDate(newDate);
    startTransition(() => {
      router.push(`/inventory/daily-report?date=${newDate}`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Date:</label>
      <input
        type="date"
        value={date}
        disabled={isPending}
        className="border border-input bg-background rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        onChange={(e) => handleChange(e.target.value)}
      />
      {isPending && <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>}
    </div>
  );
}
