import { db } from "@/lib/db";
import { expenses } from "@/db/schema/expenses";
import { auditLogs } from "@/db/schema/auditLogs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { eq, and } from "drizzle-orm";
import ExpenseForm from "./ExpenseForm";
import { expenseCategories } from "@/db/schema/expenseCategories";
import { paymentAllocations } from "@/db/schema/paymentAllocations";

type ActionState = { error?: string };

async function createExpense(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const title = String(formData.get("title") || "").trim();
  const amountStr = String(formData.get("amount") || "").trim();
  const dateStr = String(formData.get("expenseDate") || "").trim();
  const expenseCategoryId = String(formData.get("expenseCategoryId") || "").trim();
  const allocMode = String(formData.get("allocMode") || "single");
  const allocA_method = String(formData.get("allocA_method") || "");
  const allocA_amount = Number(String(formData.get("allocA_amount") || "0"));
  const allocB_method = String(formData.get("allocB_method") || "");
  const allocB_amount = Number(String(formData.get("allocB_amount") || "0"));

  const amount = Number(amountStr);

  if (!title) return { error: "Title is required." };
  if (Number.isNaN(amount) || amount <= 0)
    return { error: "Amount must be greater than 0." };
  if (!dateStr) return { error: "Expense Date is required." };

  const pmRows = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true));
  const validPaymentMethods = new Set(pmRows.map((p) => p.id));

  let allocations: Array<{ paymentMethodId: string; amount: number }> = [];
  if (allocMode === "single") {
    if (!allocA_method) return { error: "Select a payment method." };
    if (!validPaymentMethods.has(allocA_method)) return { error: "Invalid payment method." };
    allocations = [{ paymentMethodId: allocA_method, amount }];
  } else {
    if (!allocA_method || !allocB_method) return { error: "Select both payment methods." };
    if (!validPaymentMethods.has(allocA_method) || !validPaymentMethods.has(allocB_method)) return { error: "Invalid payment method." };
    if (allocA_method === allocB_method) return { error: "Cannot select the same payment method twice." };
    if (!Number.isFinite(allocA_amount) || allocA_amount <= 0 || !Number.isFinite(allocB_amount) || allocB_amount <= 0) {
      return { error: "Amounts must be > 0." };
    }
    if (Math.round((allocA_amount + allocB_amount) * 100) !== Math.round(amount * 100)) {
      return { error: "Amount A + Amount B must equal total." };
    }
    allocations = [
      { paymentMethodId: allocA_method, amount: allocA_amount },
      { paymentMethodId: allocB_method, amount: allocB_amount },
    ];
  }

  if (allocations.some((a) => !a.paymentMethodId)) {
    return { error: "Payment method is required for all allocations." };
  }

  await db.transaction(async (tx) => {
    const catId = expenseCategoryId || null;
    let catName: string | null = null;
    if (catId) {
      const crows = await tx.select().from(expenseCategories).where(eq(expenseCategories.id, catId)).limit(1);
      catName = crows[0]?.name ?? null;
    }
    const inserted = await tx
      .insert(expenses)
      .values({
        title,
        category: catName ?? "",
        amount,
        expenseDate: dateStr,
        paymentMethodId: null,
        expenseCategoryId: catId,
      })
      .returning({ id: expenses.id });
    const id = inserted[0].id;
    await tx.delete(paymentAllocations).where(and(eq(paymentAllocations.entityType, "EXPENSE"), eq(paymentAllocations.entityId, id)));
    await tx.insert(paymentAllocations).values(
      allocations.map((a) => ({
        entityType: "EXPENSE" as const,
        entityId: id,
        paymentMethodId: a.paymentMethodId,
        amount: a.amount,
      }))
    );
    await tx.insert(auditLogs).values({
      entityType: "EXPENSE",
      entityId: id,
      action: "CREATE",
      afterData: {
        id,
        title,
        category: catName ?? "",
        amount,
        expenseDate: dateStr,
        expenseCategoryId: catId || undefined,
        expenseCategoryName: catName || undefined,
        allocations: allocations.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: a.amount })),
      },
    });
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}

export default async function Page() {
  const methods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.isActive, true))
    .orderBy(paymentMethods.name);
  let categories: { id: string; name: string }[] = [];
  try {
    const rows = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.isActive, true))
      .orderBy(expenseCategories.name);
    categories = rows.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    categories = [];
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Expense</h1>
        <Link className="text-primary underline hover:text-primary/80" href="/expenses">
          Back to Expenses
        </Link>
      </div>
      <ExpenseForm
        action={createExpense}
        paymentMethods={methods.map((m) => ({ id: m.id, name: m.name }))}
        expenseCategories={categories}
      />
    </div>
  );
}
