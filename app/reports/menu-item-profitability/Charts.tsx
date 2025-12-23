"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCurrencyNaira } from "@/lib/format";

type ProfitItem = { name: string; profit: number };
type QtyItem = { name: string; qty: number };

function ProfitTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (active && payload && payload.length) {
    const p = payload[0];
    const val = fmtCurrencyNaira(Number(p.value) || 0);
    return (
      <div className="text-xs bg-popover text-popover-foreground border border-border rounded px-2 py-1">
        {`${label}: ${val} profit`}
      </div>
    );
  }
  return null;
}

function QtyTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (active && payload && payload.length) {
    const p = payload[0];
    const val = Math.round(Number(p.value) || 0).toLocaleString();
    return (
      <div className="text-xs bg-popover text-popover-foreground border border-border rounded px-2 py-1">
        {`${label}: ${val} units sold`}
      </div>
    );
  }
  return null;
}

export default function Charts({
  topProfit,
  topQty,
}: {
  topProfit: ProfitItem[];
  topQty: QtyItem[];
}) {
  return (
    <div className="space-y-2">
      <div className="font-medium text-lg">Visual Insights</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-64 border border-border rounded p-2">
          {topProfit && topProfit.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProfit}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<ProfitTooltip />} />
                <Bar dataKey="profit" name="Profit" fill="var(--success)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-muted-foreground">Not enough data to display chart</div>
          )}
        </div>
        <div className="h-64 border border-border rounded p-2">
          {topQty && topQty.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topQty}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<QtyTooltip />} />
                <Bar dataKey="qty" name="Quantity" fill="var(--primary)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-muted-foreground">Not enough data to display chart</div>
          )}
        </div>
      </div>
    </div>
  );
}
