"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { fmtCurrencyNaira } from "@/lib/format";

type TrendPoint = { label: string; revenue: number; cogs: number; profit: number };
type MarginPoint = { label: string; margin: number };

function AmtTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (active && payload && payload.length) {
    const parts = ["Revenue", "COGS", "Profit"];
    return (
      <div className="text-xs bg-popover text-popover-foreground border border-border rounded px-2 py-1">
        <div className="font-medium">{label}</div>
        {payload.map((p, i) => (
          <div key={i}>{parts[i]}: {fmtCurrencyNaira(p.value || 0)}</div>
        ))}
      </div>
    );
  }
  return null;
}

function PctTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (active && payload && payload.length) {
    const p = payload[0];
    const val = Number(p.value) || 0;
    return (
      <div className="text-xs bg-popover text-popover-foreground border border-border rounded px-2 py-1">
        {`${label}: ${val.toFixed(1)}%`}
      </div>
    );
  }
  return null;
}

export default function Charts({
  trend,
  margins,
}: {
  trend: TrendPoint[];
  margins: MarginPoint[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="h-64 border rounded p-2">
        {trend && trend.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip content={<AmtTooltip />} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--primary)" dot={false} />
              <Line type="monotone" dataKey="cogs" name="COGS" stroke="var(--destructive)" dot={false} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="var(--success)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">No sales in selected period</div>
        )}
      </div>
      <div className="h-64 border rounded p-2">
        {margins && margins.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={margins}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip content={<PctTooltip />} />
              <Bar dataKey="margin" name="Margin %" isAnimationActive={false} fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">No sales in selected period</div>
        )}
      </div>
    </div>
  );
}

