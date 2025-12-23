import { db } from "@/lib/db";
import { expenses } from "@/db/schema/expenses";
import { auditLogs } from "@/db/schema/auditLogs";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditExpenseForm from "./EditExpenseForm";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { expenseCategories } from "@/db/schema/expenseCategories";
import { paymentAllocations } from "@/db/schema/paymentAllocations";

type ActionState = { error?: string };

async function updateExpense(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id") || "");
  const amountStr = String(formData.get("amount") || "");
  const title = String(formData.get("title") || "").trim();
  const expenseDate = String(formData.get("expenseDate") || "").trim();
  const expenseCategoryId = String(formData.get("expenseCategoryId") || "").trim();
  const allocMode = String(formData.get("allocMode") || "single");
  const allocA_method = String(formData.get("allocA_method") || "");
  const allocA_amount = Number(String(formData.get("allocA_amount") || "0"));
  const allocB_method = String(formData.get("allocB_method") || "");
  const allocB_amount = Number(String(formData.get("allocB_amount") || "0"));
  const amount = Number(amountStr);
  if (!id) return { error: "Invalid expense id." };
  if (!title) return { error: "Description is required." };
  if (!expenseDate) return { error: "Date is required." };
  if (Number.isNaN(amount) || amount <= 0) return { error: "Amount must be > 0." };
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
  const beforeRows = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (beforeRows.length === 0) {
    return { error: "Expense not found." };
  }
  const before = beforeRows[0];
  const catId = expenseCategoryId || null;
  let catName: string | null = null;
  if (catId) {
    const crows = await db.select().from(expenseCategories).where(eq(expenseCategories.id, catId)).limit(1);
    catName = crows[0]?.name ?? null;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        title,
        category: catName ?? before.category,
        amount,
        expenseDate,
        paymentMethodId: null,
        expenseCategoryId: catId,
      })
      .where(eq(expenses.id, id));
    const existingAllocs = await tx.select().from(paymentAllocations).where(and(eq(paymentAllocations.entityType, "EXPENSE"), eq(paymentAllocations.entityId, id)));
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
      action: "UPDATE",
      beforeData: {
        id: before.id,
        title: before.title,
        category: before.category,
        amount: Number(before.amount),
        expenseDate: before.expenseDate,
        allocations: existingAllocs.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: Number(a.amount) || 0 })),
        expenseCategoryId: before.expenseCategoryId ?? undefined,
      },
      afterData: {
        id,
        title,
        category: catName ?? before.category,
        amount,
        expenseDate,
        expenseCategoryId: catId || undefined,
        expenseCategoryName: catName || undefined,
        allocations: allocations.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: a.amount })),
      },
    });
  });
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");
  revalidatePath("/expenses");
  redirect("/expenses?updated=1");
  return {};
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (rows.length === 0) {
    notFound();
  }
  const e = rows[0];
  const methods = await db.select().from(paymentMethods).orderBy(paymentMethods.name);
  let categories: { id: string; name: string }[] = [];
  try {
    const cats = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.isActive, true))
      .orderBy(expenseCategories.name);
    categories = cats.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    categories = [];
  }
  if (e.expenseCategoryId && !categories.find((c) => c.id === e.expenseCategoryId)) {
    try {
      const crow = await db.select().from(expenseCategories).where(eq(expenseCategories.id, e.expenseCategoryId)).limit(1);
      if (crow.length > 0) {
        categories = [...categories, { id: crow[0].id, name: crow[0].name }];
      }
    } catch {}
  }
  const existingAllocs = await db.select().from(paymentAllocations).where(and(eq(paymentAllocations.entityType, "EXPENSE"), eq(paymentAllocations.entityId, id)));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Expense</h1>
        <Link className="text-primary underline hover:text-primary/80" href="/expenses">
          Back to Expenses
        </Link>
      </div>
      <div className="border border-warning/20 bg-warning/15 text-warning p-3 rounded">
        Editing this expense will update financial reports. Use this only to correct mistakes.
      </div>
      <EditExpenseForm
        current={{
          id: e.id,
          title: e.title,
          category: e.category,
          amount: Number(e.amount),
          expenseDate: e.expenseDate as unknown as string,
          expenseCategoryId: e.expenseCategoryId ?? undefined,
        }}
        action={updateExpense}
        paymentMethods={methods.map((m) => ({ id: m.id, name: m.name }))}
        allocations={existingAllocs.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: Number(a.amount) || 0 }))}
        expenseCategories={categories}
      />
    </div>
  );
}
