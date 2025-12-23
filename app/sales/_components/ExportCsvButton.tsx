'use client';

type OldRow = {
  dateISO: string;
  paymentMethod: string;
  amount: number;
  items: string[];
};

type NewSale = {
  id: string;
  createdAt: Date;
  totalAmount: number;
  paymentMethodName?: string | null;
  items?: string[];
  allocations?: Array<{ methodName: string; amount: number }>;
};

function fmtDate(d: Date) {
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

export default function ExportCsvButton(props: { rows?: OldRow[]; sales?: NewSale[]; disabled?: boolean; start?: string; end?: string }) {
  const rows = props.rows || [];
  const sales = props.sales || [];
  const disabled = props.disabled ?? ((sales.length > 0 ? sales.length : rows.length) === 0);

  const onExport = () => {
    const sourceSales: NewSale[] =
      sales.length > 0
        ? sales
        : rows.map((r) => ({
            id: "",
            createdAt: new Date(r.dateISO),
            totalAmount: r.amount,
            paymentMethodName: r.paymentMethod,
            items: r.items,
          }));
    if (!sourceSales || sourceSales.length === 0) return;
    const header = ["Date", "Sale ID", "Payment Method", "Total Amount", "Items Sold"];
    const lines: string[] = [];
    const fmtYmd = (s?: string) => {
      if (!s) return "";
      return s;
    };
    const startLabel = fmtYmd(props.start);
    const endLabel = fmtYmd(props.end);
    let periodText = "All Time";
    if (startLabel && endLabel) {
      periodText = `${startLabel} to ${endLabel}`;
    } else if (startLabel) {
      periodText = `From ${startLabel}`;
    } else if (endLabel) {
      periodText = `Up to ${endLabel}`;
    }
    const pmNames = new Set<string>();
    for (const s of sourceSales) {
      const allocs = s.allocations || [];
      if (allocs.length > 0) {
        for (const a of allocs) {
          const nm = a.methodName || "";
          if (nm && nm !== "—") pmNames.add(nm);
        }
      } else {
        const nm = s.paymentMethodName || "";
        if (nm && nm !== "—") pmNames.add(nm);
      }
    }
    const pmLabel = pmNames.size === 1 ? Array.from(pmNames)[0] : "All";
    lines.push(["Export Period", periodText].map(csvEscape).join(","));
    lines.push(["Payment Method", pmLabel].map(csvEscape).join(","));
    lines.push("");
    lines.push(header.map(csvEscape).join(","));
    let total = 0;
    const totalsByPaymentMethod = new Map<string, number>();
    for (const s of sourceSales) {
      const date = fmtDate(new Date(s.createdAt));
      const pm = s.paymentMethodName || "—";
      const amt = Number.isFinite(s.totalAmount) ? String(s.totalAmount) : "0";
      total += Number.isFinite(s.totalAmount) ? s.totalAmount : 0;
      const allocs = s.allocations || [];
      if (allocs.length > 0) {
        for (const a of allocs) {
          const prev = totalsByPaymentMethod.get(a.methodName || "—") ?? 0;
          totalsByPaymentMethod.set(a.methodName || "—", prev + (Number.isFinite(a.amount) ? a.amount : 0));
        }
      } else {
        const prev = totalsByPaymentMethod.get(pm) ?? 0;
        totalsByPaymentMethod.set(pm, prev + (Number.isFinite(s.totalAmount) ? s.totalAmount : 0));
      }
      const itemsArr = s.items || [];
      const items = itemsArr.length > 0 ? itemsArr.join(", ") : "—";
      lines.push([date, s.id, pm, amt, items].map(csvEscape).join(","));
    }
    lines.push(["TOTALS", "", "", String(total), ""].map(csvEscape).join(","));
    if (sourceSales.length > 0 && totalsByPaymentMethod.size > 0) {
      lines.push("");
      lines.push(["PAYMENT METHOD TOTALS", "", "", "", ""].map(csvEscape).join(","));
      const sorted = Array.from(totalsByPaymentMethod.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      );
      for (const [pmName, pmTotal] of sorted) {
        lines.push([pmName, "", "", String(pmTotal), ""].map(csvEscape).join(","));
      }
    }
    const csv = lines.join("\n");
    const today = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const fname = `sales-export-${ymd}.csv`;
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
      title={disabled ? "No sales to export" : "Export CSV"}
    >
      Export CSV
    </button>
  );
}
