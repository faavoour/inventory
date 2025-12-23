'use client';

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

export default function DatePresets({
  presets,
}: {
  presets: { label: string; start: string; end: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStart = searchParams.get("start");
  const currentEnd = searchParams.get("end");

  // Helper to preserve existing params while updating date range
  const getHref = (start: string, end: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", start);
    params.set("end", end);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex items-center gap-2">
      {presets.map((p, i) => {
        const isActive =
          (currentStart === p.start && currentEnd === p.end) ||
          (!currentStart && !currentEnd && i === 0);
        return (
          <Link
            key={p.label}
            href={getHref(p.start, p.end)}
            className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 border shadow-sm ${
              isActive
                ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground border-input"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
