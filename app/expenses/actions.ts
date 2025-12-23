'use server';

import { db } from "@/lib/db";
import { expenses } from "@/db/schema/expenses";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import { auditLogs } from "@/db/schema/auditLogs";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionState = { error?: string };

export async function deleteExpense(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Invalid id." };
  }
  try {
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1);
      const allocs = await tx.select().from(paymentAllocations).where(and(eq(paymentAllocations.entityType, "EXPENSE"), eq(paymentAllocations.entityId, id)));
      await tx.delete(paymentAllocations).where(and(eq(paymentAllocations.entityType, "EXPENSE"), eq(paymentAllocations.entityId, id)));
      await tx.delete(expenses).where(eq(expenses.id, id));
      if (rows.length > 0) {
        const e = rows[0];
        await tx.insert(auditLogs).values({
          entityType: "EXPENSE",
          entityId: id,
          action: "DELETE",
          beforeData: {
            id: e.id,
            title: e.title,
            category: e.category,
            amount: Number(e.amount),
            expenseDate: e.expenseDate,
            allocations: allocs.map((a) => ({ paymentMethodId: a.paymentMethodId, amount: Number(a.amount) || 0 })),
          },
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Deletion failed.";
    return { error: msg };
  }
  revalidatePath("/expenses");
  redirect("/expenses?deleted=1");
  return {};
}
