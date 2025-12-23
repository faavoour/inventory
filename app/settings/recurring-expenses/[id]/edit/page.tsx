import { db } from "@/lib/db";
import { recurringExpenses } from "@/db/schema/recurring";
import { auditLogs } from "@/db/schema/auditLogs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import EditRecurringExpenseForm from "./EditRecurringExpenseForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ActionState = { error?: string };

async function updateRecurringExpense(prevState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const amountStr = String(formData.get("amount") || "").trim();
  const frequency = String(formData.get("frequency") || "").trim() as "MONTHLY" | "YEARLY";
  const startDateStr = String(formData.get("startDate") || "").trim();

  if (!id || !name || !amountStr || !frequency || !startDateStr) {
    return { error: "All fields are required." };
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { error: "Invalid amount." };
  }

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(recurringExpenses).where(eq(recurringExpenses.id, id)).limit(1);
    if (!existing.length) throw new Error("Expense not found");
    const before = existing[0];

    await tx.update(recurringExpenses).set({
      name,
      amount: amount.toString(),
      frequency,
      startDate: startDateStr,
    }).where(eq(recurringExpenses.id, id));

    const after = { ...before, name, amount: amount.toString(), frequency, startDate: startDateStr };

    await tx.insert(auditLogs).values({
      entityType: "RECURRING_EXPENSE",
      entityId: id,
      action: "UPDATE",
      beforeData: before,
      afterData: after,
    });
  });

  revalidatePath("/settings/recurring-expenses");
  redirect("/settings/recurring-expenses");
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(recurringExpenses).where(eq(recurringExpenses.id, id)).limit(1);
  
  if (rows.length === 0) {
    return <div>Expense not found</div>;
  }

  const expense = rows[0];

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-3">
          <Link className="underline text-sm" href="/settings/recurring-expenses">
            ← Back to Recurring Expenses
          </Link>
          <h1 className="text-2xl font-semibold">Edit Recurring Expense</h1>
      </div>
      <EditRecurringExpenseForm 
        expense={{
            id: expense.id,
            name: expense.name,
            amount: expense.amount,
            frequency: expense.frequency,
            startDate: expense.startDate
        }} 
        action={updateRecurringExpense} 
      />
    </div>
  );
}
