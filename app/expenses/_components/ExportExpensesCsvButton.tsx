'use client';

type Row = {
  id: string;
  dateStr: string;
  category?: string;
  title: string;
  amount: number;
  paymentMethod?: string;
  allocations?: Array<{ methodName: string; amount: number }>;
};

function fmtDateTimeFromDateStr(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function csvEscape(val: string) {
  const s = String(val ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function ExportExpensesCsvButton({
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
    const header = ["Date", "Expense ID", "Category", "Payment Method", "Description", "Amount"];
    const lines: string[] = [];
    const period =
      start && end ? `${start} to ${end}` : start ? `From ${start}` : end ? `Up to ${end}` : "All Time";
    lines.push(["Export Period", period].map(csvEscape).join(","));
    lines.push("");
    lines.push(header.map(csvEscape).join(","));
    let total = 0;
    const totalsByName = new Map<string, number>();
    const totalsByCategory = new Map<string, number>();
    for (const r of rows) {
      const date = fmtDateTimeFromDateStr(r.dateStr);
      const cat = r.category || "";
      const pm = r.paymentMethod || "";
      const desc = r.title || "";
      const amt = Number.isFinite(r.amount) ? String(r.amount) : "0";
      const amtNum = Number.isFinite(r.amount) ? r.amount : 0;
      total += amtNum;
      const allocs = r.allocations || [];
      if (allocs.length > 0) {
        for (const a of allocs) {
          const nm = a.methodName || "—";
          totalsByName.set(nm, (totalsByName.get(nm) ?? 0) + (Number.isFinite(a.amount) ? a.amount : 0));
        }
      } else {
        const name = pm || "—";
        totalsByName.set(name, (totalsByName.get(name) ?? 0) + amtNum);
      }
      const catName = cat && cat !== "—" ? cat : "Uncategorized";
      totalsByCategory.set(catName, (totalsByCategory.get(catName) ?? 0) + amtNum);
      lines.push([date, r.id, cat, pm, desc, amt].map(csvEscape).join(","));
    }
    lines.push(["TOTALS", "", "", "", String(total), ""].map(csvEscape).join(","));
    lines.push("");
    lines.push(["PAYMENT METHOD TOTALS", "", "", "", "", ""].map(csvEscape).join(","));
    const totalsList = Array.from(totalsByName.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [name, t] of totalsList) {
      lines.push([name, "", "", "", String(t), ""].map(csvEscape).join(","));
    }
    lines.push("");
    lines.push(["CATEGORY BREAKDOWN", "", "", "", "", ""].map(csvEscape).join(","));
    const categoryList = Array.from(totalsByCategory.entries()).sort((a, b) => b[1] - a[1]);
    for (const [name, t] of categoryList) {
      lines.push([name, "", "", "", String(t), ""].map(csvEscape).join(","));
    }
    const csv = lines.join("\n");
    const today = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const fname =
      start && end && start.length > 0 && end.length > 0
        ? `expenses-export-${start}_to_${end}.csv`
        : `expenses-export-${ymd}.csv`;
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
      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
      onClick={onExport}
      disabled={!!disabled}
      aria-disabled={!!disabled}
      title={disabled ? "No expenses to export" : "Export CSV"}
    >
      Export CSV
    </button>
  );
}
