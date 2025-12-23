import { db } from "@/lib/db";
import { recurringExpenses } from "@/db/schema/recurring";
import { auditLogs } from "@/db/schema/auditLogs";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import RecurringExpenseForm from "./RecurringExpenseForm";
import RecurringExpenseActions from "./RecurringExpenseActions";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type ActionState = { error?: string };

async function createRecurringExpense(prevState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const amountStr = String(formData.get("amount") || "").trim();
  const frequency = String(formData.get("frequency") || "").trim() as "MONTHLY" | "YEARLY";
  const startDateStr = String(formData.get("startDate") || "").trim();

  if (!name || !amountStr || !frequency || !startDateStr) {
    return { error: "All fields are required." };
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { error: "Invalid amount." };
  }

  await db.transaction(async (tx) => {
    const rows = await tx.insert(recurringExpenses).values({
      name,
      amount: amount.toString(),
      frequency,
      startDate: startDateStr,
      isActive: true,
    }).returning();
    
    const newExpense = rows[0];

    await tx.insert(auditLogs).values({
      entityType: "RECURRING_EXPENSE",
      entityId: newExpense.id,
      action: "CREATE",
      afterData: newExpense,
    });
  });

  revalidatePath("/settings/recurring-expenses");
  return {};
}

async function deactivateRecurringExpense(prevState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id"));
  if (!id) return { error: "ID required" };

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(recurringExpenses).where(eq(recurringExpenses.id, id)).limit(1);
    if (!existing.length) return; 
    const before = existing[0];

    await tx.update(recurringExpenses).set({ isActive: false }).where(eq(recurringExpenses.id, id));
    
    await tx.insert(auditLogs).values({
      entityType: "RECURRING_EXPENSE",
      entityId: id,
      action: "DEACTIVATE",
      beforeData: before,
      afterData: { ...before, isActive: false },
    });
  });
  
  revalidatePath("/settings/recurring-expenses");
  return {};
}

async function reactivateRecurringExpense(prevState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id"));
  if (!id) return { error: "ID required" };

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(recurringExpenses).where(eq(recurringExpenses.id, id)).limit(1);
    if (!existing.length) return;
    const before = existing[0];

    await tx.update(recurringExpenses).set({ isActive: true }).where(eq(recurringExpenses.id, id));

    await tx.insert(auditLogs).values({
      entityType: "RECURRING_EXPENSE",
      entityId: id,
      action: "REACTIVATE",
      beforeData: before,
      afterData: { ...before, isActive: true },
    });
  });
  
  revalidatePath("/settings/recurring-expenses");
  return {};
}

async function deleteRecurringExpense(prevState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id"));
  if (!id) return { error: "ID required" };

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(recurringExpenses).where(eq(recurringExpenses.id, id)).limit(1);
    if (!existing.length) return;
    const before = existing[0];

    await tx.delete(recurringExpenses).where(eq(recurringExpenses.id, id));

    await tx.insert(auditLogs).values({
      entityType: "RECURRING_EXPENSE",
      entityId: id,
      action: "DELETE",
      beforeData: before,
    });
  });
  
  revalidatePath("/settings/recurring-expenses");
  return {};
}

export default async function Page() {
  const expenses = await db.select().from(recurringExpenses).orderBy(desc(recurringExpenses.createdAt));

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline text-sm" href="/settings">
            ← Back to Settings
          </Link>
          <h1 className="text-2xl font-semibold">Recurring Expenses</h1>
        </div>
      </div>

      <RecurringExpenseForm action={createRecurringExpense} />

      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Frequency</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Start Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {expenses.length === 0 ? (
                <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No recurring expenses found.
                    </td>
                </tr>
            ) : (
                expenses.map((expense) => (
                    <tr key={expense.id}>
                        <td className="px-4 py-3 text-sm">{expense.name}</td>
                        <td className="px-4 py-3 text-sm">{formatCurrency(Number(expense.amount))}</td>
                        <td className="px-4 py-3 text-sm">{expense.frequency}</td>
                        <td className="px-4 py-3 text-sm">{expense.startDate}</td>
                        <td className="px-4 py-3 text-sm">
                             <span
                                className={`px-2 py-1 rounded text-xs border ${
                                    expense.isActive
                                    ? "bg-success/15 text-success border-success/20"
                                    : "bg-warning/15 text-warning border-warning/20"
                                }`}
                            >
                                {expense.isActive ? "Active" : "Inactive"}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                            <RecurringExpenseActions
                                id={expense.id}
                                isActive={expense.isActive}
                                onDeactivate={deactivateRecurringExpense}
                                onReactivate={reactivateRecurringExpense}
                                onDelete={deleteRecurringExpense}
                            />
                        </td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
