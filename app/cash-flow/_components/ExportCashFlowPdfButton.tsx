'use client';

import { jsPDF } from "jspdf";
import { fmtCurrencyNaira } from "@/lib/format";

type Row = {
  name: string;
  sales: number;
  expenses: number;
  net: number;
};

export default function ExportCashFlowPdfButton({
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
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;

    const now = new Date();
    const period =
      start && end ? `${start} to ${end}` : start ? `From ${start}` : end ? `Up to ${end}` : "All Time";

    doc.setFontSize(18);
    doc.text("Cash Flow Report", margin, y);
    y += 26;
    doc.setFontSize(12);
    doc.text(`Export Period: ${period}`, margin, y);
    y += 18;
    doc.text(
      `Generated: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      margin,
      y
    );
    y += 24;

    const drawTableHeader = () => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Payment Method", margin, y);
      doc.text("Sales", margin + 220, y);
      doc.text("Expenses", margin + 340, y);
      doc.text("Net Cash Flow", margin + 460, y);
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

    let totalSales = 0;
    let totalExpenses = 0;
    let totalNet = 0;
    for (const r of rows) {
      const s = Number(r.sales) || 0;
      const e = Number(r.expenses) || 0;
      const n = Number(r.net) || 0;
      totalSales += s;
      totalExpenses += e;
      totalNet += n;
      ensureSpace(16);
      doc.text(r.name, margin, y);
      doc.text(fmtCurrencyNaira(s), margin + 220, y);
      doc.text(fmtCurrencyNaira(e), margin + 340, y);
      doc.text(fmtCurrencyNaira(n), margin + 460, y);
      y += 16;
    }

    y += 10;
    doc.line(margin, y, margin + contentWidth, y);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.text(
      `TOTALS — Sales: ${fmtCurrencyNaira(totalSales)}  Expenses: ${fmtCurrencyNaira(
        totalExpenses
      )}  Net: ${fmtCurrencyNaira(totalNet)}`,
      margin,
      y
    );
    doc.setFont("helvetica", "normal");
    y += 22;

    const filename =
      start && end
        ? `cash-flow-${start}_to_${end}.pdf`
        : `cash-flow-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
            now.getDate()
          ).padStart(2, "0")}.pdf`;
    doc.save(filename);
  };

  return (
    <button
      type="button"
      className="px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
      onClick={onExport}
      disabled={!!disabled}
      aria-disabled={!!disabled}
      title={disabled ? "No rows to export" : "Export PDF"}
    >
      Export PDF
    </button>
  );
}
