'use client';

import { jsPDF } from "jspdf";
import { fmtCurrencyNaira } from "@/lib/format";

type Row = {
  id: string;
  dateStr: string;
  category?: string;
  paymentMethod?: string;
  title: string;
  amount: number;
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

export default function ExportExpensesPdfButton({
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
    const totalsByName = new Map<string, number>();
    const totalsByCategory = new Map<string, number>();

    const now = new Date();
    const period =
      start && end ? `${start} to ${end}` : start ? `From ${start}` : end ? `Up to ${end}` : "All Time";

    doc.setFontSize(18);
    doc.text("Expenses Report", margin, y);
    y += 26;
    doc.setFontSize(12);
    doc.text(`Export Period: ${period}`, margin, y);
    y += 18;
    doc.text(`Generated: ${fmtDateTimeFromDateStr(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`)}`, margin, y);
    y += 24;

    const drawTableHeader = () => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Date", margin, y);
      doc.text("Category", margin + 120, y);
      doc.text("Payment Method", margin + 240, y);
      doc.text("Description", margin + 360, y);
      doc.text("Amount", margin + 480, y);
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
    for (const r of rows) {
      const date = fmtDateTimeFromDateStr(r.dateStr);
      const cat = r.category || "";
      const pm = r.paymentMethod || "";
      const desc = r.title || "";
      const amtNum = Number.isFinite(r.amount) ? r.amount : 0;
      const amt = fmtCurrencyNaira(amtNum);
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

      const lines = doc.splitTextToSize(desc, contentWidth - 360 - 20);
      ensureSpace(16 + (lines.length - 1) * 14);
      doc.text(date, margin, y);
      doc.text(cat, margin + 120, y);
      doc.text(pm, margin + 240, y);
      doc.text(lines, margin + 360, y);
      doc.text(amt, margin + 480, y);
      y += 16 + (lines.length - 1) * 14;
    }

    y += 10;
    doc.line(margin, y, margin + contentWidth, y);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.text(`Total Expenses Amount: ${fmtCurrencyNaira(total)}`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.text("Payment Method Breakdown", margin, y);
    doc.setFont("helvetica", "normal");
    y += 18;
    const breakdown = Array.from(totalsByName.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [name, t] of breakdown) {
      ensureSpace(16);
      doc.text(`${name}: ${fmtCurrencyNaira(t)}`, margin, y);
      y += 16;
    }
    y += 10;
    doc.line(margin, y, margin + contentWidth, y);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.text("Category Breakdown", margin, y);
    doc.setFont("helvetica", "normal");
    y += 18;
    const catBreakdown = Array.from(totalsByCategory.entries()).sort((a, b) => b[1] - a[1]);
    for (const [name, t] of catBreakdown) {
      ensureSpace(16);
      doc.text(`${name}: ${fmtCurrencyNaira(t)}`, margin, y);
      y += 16;
    }

    const filename =
      start && end
        ? `expenses-report-${start}_to_${end}.pdf`
        : `expenses-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
            now.getDate()
          ).padStart(2, "0")}.pdf`;
    doc.save(filename);
  };

  return (
    <button
      type="button"
      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
      onClick={onExport}
      disabled={!!disabled}
      aria-disabled={!!disabled}
      title={disabled ? "No expenses to export" : "Export PDF"}
    >
      Export PDF
    </button>
  );
}
