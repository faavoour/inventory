'use client';

import { useState } from "react";
import Link from "next/link";
import { fmtCurrencyNaira } from "@/lib/format";
import DeleteExpenseButton from "./DeleteExpenseButton";
import { deleteExpense } from "../actions";

type ExpenseRow = {
  id: string;
  dateStr: string;
  category: string;
  title: string;
  amount: number;
  paymentMethod: string;
  allocations: { methodName: string; amount: number }[];
  expenseCategoryId?: string | null;
};

type PaymentMethod = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
};

export default function ExpensesTable({
  rows,
  paymentMethods,
  categories,
}: {
  rows: ExpenseRow[];
  paymentMethods: PaymentMethod[];
  categories: Category[];
}) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredRows = rows.filter((r) => {
    const matchesPayment =
      selectedPaymentMethod === "All" ||
      r.allocations.some((a) => a.methodName === selectedPaymentMethod);

    // For category, we match against the category name displayed or the id if available
    // The row has 'category' string which is the resolved name
    const matchesCategory =
      selectedCategory === "All" ||
      r.category === selectedCategory || 
      (r.expenseCategoryId === selectedCategory); // In case we filter by ID but display Name

    // Wait, the dropdown options for category use Category Name as value or ID?
    // Let's use Name for the value to match the row.category string which is what we see.
    // Or better, let's use the ID if we can.
    // The row has `expenseCategoryId`.
    // If it's "Uncategorized", ID might be null.
    
    if (selectedCategory === "All") return matchesPayment;

    // Check if selectedCategory is an ID or Name. 
    // If we put Names in the option values, we compare with r.category.
    return matchesPayment && r.category === selectedCategory;
  });

  const totalAmount = filteredRows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Date
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Category</span>
                    <select
                      className="h-8 w-[150px] rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="All">All</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Description
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Payment Method</span>
                    <select
                      className="h-8 w-[150px] rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedPaymentMethod}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    >
                      <option value="All">All</option>
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No expenses found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="p-4 align-middle">
                      {new Date(expense.dateStr).toLocaleDateString()}
                    </td>
                    <td className="p-4 align-middle">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                        {expense.category}
                      </span>
                    </td>
                    <td className="p-4 align-middle">{expense.title}</td>
                    <td className="p-4 align-middle font-medium">
                      {fmtCurrencyNaira(expense.amount)}
                    </td>
                    <td className="p-4 align-middle">
                      {expense.paymentMethod}
                    </td>
                    <td className="p-4 align-middle">
                      <DeleteExpenseButton id={expense.id} action={deleteExpense} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="border-t bg-muted/50 font-medium [&>tr]:last:border-b-0">
              <tr>
                <td className="p-4 align-middle">Total</td>
                <td className="p-4 align-middle"></td>
                <td className="p-4 align-middle"></td>
                <td className="p-4 align-middle">
                  {fmtCurrencyNaira(totalAmount)}
                </td>
                <td className="p-4 align-middle"></td>
                <td className="p-4 align-middle"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
