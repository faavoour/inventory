"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
type TTProps = {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string | number;
};

type SupplierMargin = { name: string; margin: number };

function MarginTooltip({ active, payload, label }: TTProps) {
  if (active && payload && payload.length) {
    const p = payload[0];
    const val = Number(p.value) || 0;
    return (
      <div className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
        {`${label}: ${val.toFixed(1)}%`}
      </div>
    );
  }
  return null;
}

export default function Charts({ data }: { data: SupplierMargin[] }) {
  return (
    <div className="space-y-2">
      <div className="font-medium text-lg">Visual Insights</div>
      <div className="h-64 border rounded p-2">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<MarginTooltip />} />
              <Bar dataKey="margin" name="Avg Margin %" isAnimationActive={false}>
                {data.map((d, idx) => (
                  <Cell key={`sm-${idx}`} fill={d.margin < 20 ? "var(--destructive)" : "var(--success)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">Not enough data to display chart</div>
        )}
      </div>
    </div>
  );
}
