import { db } from "@/lib/db";
import { paymentMethods } from "@/db/schema/paymentMethods";
import Link from "next/link";
import { eq, desc, sql } from "drizzle-orm";
import PaymentMethodForm from "./PaymentMethodForm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLogs } from "@/db/schema/auditLogs";
import PaymentMethodActions from "./PaymentMethodActions";
import { paymentAllocations } from "@/db/schema/paymentAllocations";

export const dynamic = "force-dynamic";

type ActionState = { error?: string };

async function createPaymentMethod(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required." };

  const existing = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.name, name))
    .limit(1);
  if (existing.length > 0) {
    return { error: "This payment method already exists." };
  }

  await db.insert(paymentMethods).values({ name });
  revalidatePath("/settings/payment-methods");
  redirect("/settings/payment-methods");
}

export async function deletePaymentMethod(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { error: "Invalid id." };
  }
  try {
    const usageRows = await db
      .select({ c: sql<number>`count(*)` })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentMethodId, id));
    const usageCount = usageRows[0]?.c ?? 0;
    if (usageCount > 0) {
      await db.transaction(async (tx) => {
        const beforeRows = await tx
          .select()
          .from(paymentMethods)
          .where(eq(paymentMethods.id, id))
          .limit(1);
        if (beforeRows.length === 0) {
          throw new Error("Payment method not found.");
        }
        const before = beforeRows[0];
        await tx
          .update(paymentMethods)
          .set({ isActive: false })
          .where(eq(paymentMethods.id, id));
        await tx.insert(auditLogs).values({
          entityType: "PAYMENT_METHOD",
          entityId: id,
          action: "DEACTIVATE",
          beforeData: { id: before.id, name: before.name, isActive: before.isActive },
          afterData: { id: before.id, name: before.name, isActive: false },
        });
      });
      revalidatePath("/settings/payment-methods");
      redirect("/settings/payment-methods?deactivated=1");
      return {};
    }
    await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
    revalidatePath("/settings/payment-methods");
    redirect("/settings/payment-methods?deleted=1");
    return {};
  } catch {
    return { error: "Unable to update payment method." };
  }
}

export async function deactivatePaymentMethod(
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
      .from(paymentMethods)
      .where(eq(paymentMethods.id, id))
      .limit(1);
    if (beforeRows.length === 0) {
      throw new Error("Payment method not found.");
    }
    const before = beforeRows[0];
    await tx
      .update(paymentMethods)
      .set({ isActive: false })
      .where(eq(paymentMethods.id, id));
    await tx.insert(auditLogs).values({
      entityType: "PAYMENT_METHOD",
      entityId: id,
      action: "DEACTIVATE",
      beforeData: { id: before.id, name: before.name, isActive: before.isActive },
      afterData: { id: before.id, name: before.name, isActive: false },
    });
  });
  revalidatePath("/settings/payment-methods");
  return {};
}

export async function reactivatePaymentMethod(
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
      .from(paymentMethods)
      .where(eq(paymentMethods.id, id))
      .limit(1);
    if (beforeRows.length === 0) {
      throw new Error("Payment method not found.");
    }
    const before = beforeRows[0];
    await tx
      .update(paymentMethods)
      .set({ isActive: true })
      .where(eq(paymentMethods.id, id));
    await tx.insert(auditLogs).values({
      entityType: "PAYMENT_METHOD",
      entityId: id,
      action: "REACTIVATE",
      beforeData: { id: before.id, name: before.name, isActive: before.isActive },
      afterData: { id: before.id, name: before.name, isActive: true },
    });
  });
  revalidatePath("/settings/payment-methods");
  return {};
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ deleted?: string; deactivated?: string }> }) {
  const params = await searchParams;
  const deleted = params?.deleted;
  const deactivated = params?.deactivated;
  const rows = await db.select().from(paymentMethods).orderBy(desc(paymentMethods.createdAt));
  const usage = await db
    .select({
      id: paymentAllocations.paymentMethodId,
      c: sql<number>`count(*)`,
    })
    .from(paymentAllocations)
    .groupBy(paymentAllocations.paymentMethodId);
  const usedIds = new Set(usage.filter((u) => u.id !== null).map((u) => u.id as string));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="text-primary hover:underline" href="/settings">
            ← Back to Settings
          </Link>
          <h1 className="text-xl font-semibold">Payment Methods</h1>
        </div>
        <Link className="text-primary hover:underline" href="/settings/payment-methods">
          Refresh
        </Link>
      </div>
      {deleted && (
        <div className="border border-success/20 bg-success/15 text-success p-3 rounded">
          Payment method deleted
        </div>
      )}
      {deactivated && (
        <div className="border border-warning/20 bg-warning/15 text-warning p-3 rounded">
          Payment method deactivated (used in records)
        </div>
      )}

      <div id="new-method">
        <PaymentMethodForm action={createPaymentMethod} />
      </div>

      {rows.length === 0 ? (
        <div className="py-12 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-lg font-medium">No payment methods added</div>
            <div className="text-muted-foreground">
              Add payment methods to track how money moves.
            </div>
            <Link
              className="inline-block mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
              href="#new-method"
            >
              Add Payment Method
            </Link>
          </div>
        </div>
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
                      className={`px-2 py-1 rounded text-xs ${
                        m.isActive
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                      }`}
                    >
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-2">
                    <PaymentMethodActions
                      id={m.id}
                      isActive={!!m.isActive}
                      usedInSales={usedIds.has(m.id)}
                      deactivateAction={deactivatePaymentMethod}
                      reactivateAction={reactivatePaymentMethod}
                      deleteAction={deletePaymentMethod}
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
