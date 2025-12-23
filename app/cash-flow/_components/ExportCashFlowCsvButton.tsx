'use client';

type Row = {
  name: string;
  sales: number;
  expenses: number;
  net: number;
};

import { fmtCurrencyNaira } from "@/lib/format";

function csvEscape(val: string) {
  const s = String(val ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function ExportCashFlowCsvButton({
  rows,
  start,
  end,
  disabled,
}: {
  rows: Row[];
  start?: string;
  end?: string;
  disabled?: boolean;
}) {
  const onExport = () => {
    if (!rows || rows.length === 0) return;
    const header = ["Payment Method", "Sales", "Expenses", "Net Cash Flow"];
    const lines: string[] = [];
    const period =
      start && end ? `${start} to ${end}` : start ? `From ${start}` : end ? `Up to ${end}` : "All Time";
    lines.push(["Export Period", period].map(csvEscape).join(","));
    lines.push("");
    lines.push(header.map(csvEscape).join(","));
    let totalSales = 0;
    let totalExpenses = 0;
    let totalNet = 0;
    for (const r of rows) {
      totalSales += Number(r.sales) || 0;
      totalExpenses += Number(r.expenses) || 0;
      totalNet += Number(r.net) || 0;
      lines.push(
        [
          r.name,
          fmtCurrencyNaira(r.sales),
          fmtCurrencyNaira(r.expenses),
          fmtCurrencyNaira(r.net),
        ].map(csvEscape).join(",")
      );
    }
    lines.push(["TOTALS", fmtCurrencyNaira(totalSales), fmtCurrencyNaira(totalExpenses), fmtCurrencyNaira(totalNet)].map(csvEscape).join(","));
    const csv = lines.join("\n");
    const today = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const fname =
      start && end && start.length > 0 && end.length > 0
        ? `cash-flow-${start}_to_${end}.csv`
        : `cash-flow-${ymd}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      className="px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
      onClick={onExport}
      disabled={!!disabled}
      aria-disabled={!!disabled}
      title={disabled ? "No rows to export" : "Export CSV"}
    >
      Export CSV
    </button>
  );
}
