import { db } from "@/lib/db";
import { expenseCategories } from "@/db/schema/expenseCategories";
import { expenses } from "@/db/schema/expenses";
import Link from "next/link";
import { eq, desc, sql } from "drizzle-orm";
import ExpenseCategoryForm from "./ExpenseCategoryForm";
import ExpenseCategoryActions from "./ExpenseCategoryActions";
import { revalidatePath } from "next/cache";
import { auditLogs } from "@/db/schema/auditLogs";

export const dynamic = "force-dynamic";

type ActionState = { error?: string };

async function createExpenseCategory(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required." };
  const existing = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.name, name))
    .limit(1);
  if (existing.length > 0) {
    return { error: "This expense category already exists." };
  }
  await db.transaction(async (tx) => {
    const rows = await tx.insert(expenseCategories).values({ name }).returning({ id: expenseCategories.id });
    const id = rows[0]?.id;
    await tx.insert(auditLogs).values({
      entityType: "EXPENSE_CATEGORY",
      entityId: id,
      action: "CREATE",
      afterData: { id, name, isActive: true },
    });
  });
  revalidatePath("/settings/expense-categories");
  return {};
}

export async function deleteExpenseCategory(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Invalid id." };
  }
  const referenced = await db
    .select()
    .from(expenses)
    .where(eq(expenses.expenseCategoryId, id))
    .limit(1);
  if (referenced.length > 0) {
    return {
      error:
        "This expense category is used by existing expenses and cannot be deleted. You can deactivate it instead.",
    };
  }
  await db.transaction(async (tx) => {
    const beforeRows = await tx.select().from(expenseCategories).where(eq(expenseCategories.id, id)).limit(1);
    await tx.delete(expenseCategories).where(eq(expenseCategories.id, id));
    const b = beforeRows[0];
    await tx.insert(auditLogs).values({
      entityType: "EXPENSE_CATEGORY",
      entityId: id,
      action: "DELETE",
      beforeData: b ? { id: b.id, name: b.name, isActive: b.isActive } : undefined,
    });
  });
  revalidatePath("/settings/expense-categories");
  return {};
}

export async function deactivateExpenseCategory(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Invalid id." };
  }
  await db.transaction(async (tx) => {
    const beforeRows = await tx
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, id))
      .limit(1);
    if (beforeRows.length === 0) {
      throw new Error("Expense category not found.");
    }
    const before = beforeRows[0];
    await tx
      .update(expenseCategories)
      .set({ isActive: false })
      .where(eq(expenseCategories.id, id));
    await tx.insert(auditLogs).values({
      entityType: "EXPENSE_CATEGORY",
      entityId: id,
      action: "DEACTIVATE",
      beforeData: { id: before.id, name: before.name, isActive: before.isActive },
      afterData: { id: before.id, name: before.name, isActive: false },
    });
  });
  revalidatePath("/settings/expense-categories");
  return {};
}

export async function reactivateExpenseCategory(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Invalid id." };
  }
  await db.transaction(async (tx) => {
    const beforeRows = await tx
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, id))
      .limit(1);
    if (beforeRows.length === 0) {
      throw new Error("Expense category not found.");
    }
    const before = beforeRows[0];
    await tx
      .update(expenseCategories)
      .set({ isActive: true })
      .where(eq(expenseCategories.id, id));
    await tx.insert(auditLogs).values({
      entityType: "EXPENSE_CATEGORY",
      entityId: id,
      action: "REACTIVATE",
      beforeData: { id: before.id, name: before.name, isActive: before.isActive },
      afterData: { id: before.id, name: before.name, isActive: true },
    });
  });
  revalidatePath("/settings/expense-categories");
  return {};
}

export default async function Page() {
  const rows = await db.select().from(expenseCategories).orderBy(desc(expenseCategories.createdAt));
  const usage = await db
    .select({
      id: expenses.expenseCategoryId,
      c: sql<number>`count(*)`,
    })
    .from(expenses)
    .groupBy(expenses.expenseCategoryId);
  const usedIds = new Set(usage.filter((u) => u.id !== null).map((u) => u.id as string));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/settings">
            ← Back to Settings
          </Link>
          <h1 className="text-2xl font-semibold">Expense Categories</h1>
        </div>
        <Link className="underline" href="/settings/expense-categories">
          Refresh
        </Link>
      </div>

      <ExpenseCategoryForm action={createExpenseCategory} />

      {rows.length === 0 ? (
        <div className="text-muted-foreground">No expense categories configured yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 border-b border-border">Name</th>
                <th className="text-left p-2 border-b border-border">Status</th>
                <th className="text-left p-2 border-b border-border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border">
                  <td className="p-2">{m.name}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded text-xs border ${
                        m.isActive
                          ? "bg-success/15 text-success border-success/20"
                          : "bg-warning/15 text-warning border-warning/20"
                      }`}
                    >
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-2">
                    <ExpenseCategoryActions
                      id={m.id}
                      isActive={!!m.isActive}
                      usedInExpenses={usedIds.has(m.id)}
                      deactivateAction={deactivateExpenseCategory}
                      reactivateAction={reactivateExpenseCategory}
                      deleteAction={deleteExpenseCategory}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

