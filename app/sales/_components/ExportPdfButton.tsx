'use client';

import { jsPDF } from "jspdf";
import { fmtCurrencyNaira } from "@/lib/format";

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

function fmtDateTime(d: Date) {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function ExportPdfButton(props: {
  rows?: OldRow[];
  sales?: NewSale[];
  disabled?: boolean;
  start?: string;
  end?: string;
}) {
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

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;

    const now = new Date();
    const period =
      props.start && props.end
        ? `${props.start} to ${props.end}`
        : props.start
        ? `From ${props.start}`
        : props.end
        ? `Up to ${props.end}`
        : "All Time";
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

    doc.setFontSize(18);
    doc.text("Sales Report", margin, y);
    y += 26;
    doc.setFontSize(12);
    doc.text(`Export Period: ${period}`, margin, y);
    y += 18;
    doc.text(`Payment Method: ${pmLabel}`, margin, y);
    y += 18;
    doc.text(`Generated: ${fmtDateTime(now)}`, margin, y);
    y += 24;

    const drawTableHeader = () => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Date", margin, y);
      doc.text("Payment Method", margin + 160, y);
      doc.text("Amount", margin + 320, y);
      doc.text("Items Sold", margin + 420, y);
      doc.setFont("helvetica", "normal");
      y += 16;
      doc.line(margin, y, margin + contentWidth, y);
      y += 10;
    };

    const ensureSpace = (needed: number) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
        drawTableHeader();
      }
    };

    drawTableHeader();

    let total = 0;
  const totalsByPaymentMethod = new Map<string, number>();
  for (const s of sourceSales) {
    const date = fmtDateTime(new Date(s.createdAt));
    const pm = s.paymentMethodName || "—";
    const amtNum = Number.isFinite(s.totalAmount) ? s.totalAmount : 0;
    const amt = fmtCurrencyNaira(amtNum);
    total += amtNum;
    const allocs = s.allocations || [];
    if (allocs.length > 0) {
      for (const a of allocs) {
        const prev = totalsByPaymentMethod.get(a.methodName || "—") ?? 0;
        totalsByPaymentMethod.set(a.methodName || "—", prev + (Number.isFinite(a.amount) ? a.amount : 0));
      }
    } else {
      const prev = totalsByPaymentMethod.get(pm) ?? 0;
      totalsByPaymentMethod.set(pm, prev + amtNum);
    }
    const itemsArr = s.items || [];
    const items = itemsArr.length > 0 ? itemsArr.join(", ") : "—";

    const lines = doc.splitTextToSize(items, contentWidth - 420);
      ensureSpace(16 + (lines.length - 1) * 14);
      doc.text(date, margin, y);
      doc.text(pm, margin + 160, y);
      doc.text(amt, margin + 320, y);
      doc.text(lines, margin + 420, y);
      y += 16 + (lines.length - 1) * 14;
    }

    y += 10;
    doc.line(margin, y, margin + contentWidth, y);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.text(`Total Sales Amount: ${fmtCurrencyNaira(total)}`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 22;

    doc.setFont("helvetica", "bold");
    doc.text("Payment Method Breakdown", margin, y);
    doc.setFont("helvetica", "normal");
    y += 16;
    const sorted = Array.from(totalsByPaymentMethod.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [pmName, pmTotal] of sorted) {
      ensureSpace(16);
      doc.text(`${pmName}: ${fmtCurrencyNaira(pmTotal)}`, margin, y);
      y += 16;
    }

    const filename =
      props.start && props.end
        ? `sales-report-${props.start}_to_${props.end}.pdf`
        : `sales-report-${fmtDateTime(now).slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  return (
    <button
      type="button"
      className="px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
      onClick={onExport}
      disabled={!!disabled}
      aria-disabled={!!disabled}
      title={disabled ? "No sales to export" : "Export PDF"}
    >
      Export PDF
    </button>
  );
}
