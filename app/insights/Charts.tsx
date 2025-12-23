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
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { fmtCurrencyNaira } from "@/lib/format";

type ProfitPoint = { date: string; profit: number };
type SalesExpensesPoint = { date: string; sales: number; expenses: number };
type BreakdownItem = { name: string; amount: number };
type CashFlowItem = { name: string; net: number };

export default function Charts({
  profitTrend,
  salesVsExpenses,
  expenseBreakdown,
  cashFlowByMethod,
}: {
  profitTrend: ProfitPoint[];
  salesVsExpenses: SalesExpensesPoint[];
  expenseBreakdown: BreakdownItem[];
  cashFlowByMethod: CashFlowItem[];
}) {
  const pieColors = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#ea580c", "#22c55e"];
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-medium mb-2">Profit Trend (Last 7 Days)</h2>
        <div className="h-64 border rounded p-2">
          {profitTrend && profitTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v: unknown) => [fmtCurrencyNaira(Number(v)), "Profit"]} 
                  contentStyle={{ backgroundColor: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)" }}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                  labelStyle={{ color: "var(--popover-foreground)" }}
                />
                <Line type="monotone" dataKey="profit" stroke="var(--primary)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Sales vs Expenses (Last 7 Days)</h2>
        <div className="h-64 border rounded p-2">
          {salesVsExpenses && salesVsExpenses.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesVsExpenses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v: unknown) => [fmtCurrencyNaira(Number(v)), "Amount"]} 
                  contentStyle={{ backgroundColor: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)" }}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                  labelStyle={{ color: "var(--popover-foreground)" }}
                />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill="var(--success)" />
                <Bar dataKey="expenses" name="Expenses" fill="var(--destructive)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-gray-500">No data</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Expense Breakdown by Category</h2>
        <div className="h-64 border rounded p-2">
          {expenseBreakdown && expenseBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(v: unknown, n: unknown) => [fmtCurrencyNaira(Number(v)), String(n)]} 
                  contentStyle={{ backgroundColor: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)" }}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                  labelStyle={{ color: "var(--popover-foreground)" }}
                />
                <Pie data={expenseBreakdown} dataKey="amount" nameKey="name" outerRadius={100} label>
                  {expenseBreakdown.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Cash Flow by Payment Method</h2>
        <div className="h-64 border rounded p-2">
          {cashFlowByMethod && cashFlowByMethod.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowByMethod}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: unknown) => [fmtCurrencyNaira(Number(v)), "Net"]} 
                  contentStyle={{ backgroundColor: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)" }}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                  labelStyle={{ color: "var(--popover-foreground)" }}
                />
                <Bar dataKey="net" name="Net Cash Flow">
                  {cashFlowByMethod.map((d, idx) => (
                    <Cell key={`cf-${idx}`} fill={d.net >= 0 ? "var(--success)" : "var(--destructive)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-gray-500">No data</div>
          )}
        </div>
      </section>
    </div>
  );
}
