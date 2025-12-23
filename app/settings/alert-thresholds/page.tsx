import { db } from "@/lib/db";
import Link from "next/link";
import { auditLogs } from "@/db/schema/auditLogs";
import { alertSettings } from "@/db/schema/alertSettings";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

const DEFAULTS = {
  profitDropPercent: 10,
  expenseSpikePercent: 150,
  cashFlowNegativeLimit: 10000,
  inventoryBlockCount: 2,
};

export async function saveThresholds(formData: FormData) {
  "use server";
  function num(field: string) {
    const v = formData.get(field);
    if (typeof v !== "string" || v.trim().length === 0) return undefined;
    const n = Number(v);
    if (Number.isNaN(n)) return undefined;
    return n;
  }
  const profitDropPercent = num("profitDropPercent");
  const expenseSpikePercent = num("expenseSpikePercent");
  const cashFlowNegativeLimit = num("cashFlowNegativeLimit");
  const inventoryBlockCount = num("inventoryBlockCount");

  if (profitDropPercent !== undefined && profitDropPercent <= 0) {
    return;
  }
  if (expenseSpikePercent !== undefined && expenseSpikePercent <= 0) {
    return;
  }
  if (cashFlowNegativeLimit !== undefined && cashFlowNegativeLimit <= 0) {
    return;
  }
  if (inventoryBlockCount !== undefined && inventoryBlockCount < 1) {
    return;
  }

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(alertSettings).limit(1);
    const before = existing[0];
    const values = {
      profitDropPercent: profitDropPercent ?? before?.profitDropPercent ?? DEFAULTS.profitDropPercent,
      expenseSpikePercent: expenseSpikePercent ?? before?.expenseSpikePercent ?? DEFAULTS.expenseSpikePercent,
      cashFlowNegativeLimit: cashFlowNegativeLimit ?? before?.cashFlowNegativeLimit ?? DEFAULTS.cashFlowNegativeLimit,
      inventoryBlockCount: inventoryBlockCount ?? before?.inventoryBlockCount ?? DEFAULTS.inventoryBlockCount,
    };
    if (before) {
      await tx.update(alertSettings).set(values).where(eq(alertSettings.id, before.id));
    } else {
      await tx.insert(alertSettings).values(values);
    }
    const afterRows = await tx.select().from(alertSettings).limit(1);
    const current = afterRows[0];
    await tx.insert(auditLogs).values({
      entityType: "ALERT_SETTINGS",
      entityId: current.id,
      action: "UPDATE",
      beforeData: before
        ? {
            profitDropPercent: before.profitDropPercent,
            expenseSpikePercent: before.expenseSpikePercent,
            cashFlowNegativeLimit: before.cashFlowNegativeLimit,
            inventoryBlockCount: before.inventoryBlockCount,
          }
        : undefined,
      afterData: values,
    });
  });
  revalidatePath("/settings/alert-thresholds");
  redirect("/settings/alert-thresholds?saved=1");
}

export async function resetToDefaults() {
  "use server";
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(alertSettings).limit(1);
    const before = existing[0];
    const values = { ...DEFAULTS };
    if (before) {
      await tx.update(alertSettings).set(values).where(eq(alertSettings.id, before.id));
    } else {
      await tx.insert(alertSettings).values(values);
    }
    const afterRows = await tx.select().from(alertSettings).limit(1);
    const current = afterRows[0];
    await tx.insert(auditLogs).values({
      entityType: "ALERT_SETTINGS",
      entityId: current.id,
      action: "UPDATE",
      beforeData: before
        ? {
            profitDropPercent: before.profitDropPercent,
            expenseSpikePercent: before.expenseSpikePercent,
            cashFlowNegativeLimit: before.cashFlowNegativeLimit,
            inventoryBlockCount: before.inventoryBlockCount,
          }
        : undefined,
      afterData: values,
    });
  });
  revalidatePath("/settings/alert-thresholds");
  redirect("/settings/alert-thresholds?reset=1");
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ saved?: string; reset?: string }> }) {
  const params = await searchParams;
  const saved = params?.saved;
  const reset = params?.reset;
  const rows = await db.select().from(alertSettings).limit(1);
  const row = rows[0];
  const placeholders = DEFAULTS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/settings">
            ← Back to Settings
          </Link>
          <h1 className="text-xl font-semibold">Alert Thresholds</h1>
        </div>
        <Link className="underline" href="/settings/alert-thresholds">
          Refresh
        </Link>
      </div>

      {saved && (
        <div className="border border-success/20 bg-success/15 text-success p-3 rounded-md text-sm">
          Alert thresholds updated.
        </div>
      )}
      {reset && (
        <div className="border border-success/20 bg-success/15 text-success p-3 rounded-md text-sm">
          Alert thresholds reset to defaults.
        </div>
      )}

      <form action={saveThresholds} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-foreground">Profit Drop Alert (%)</label>
          <input
            type="number"
            step="0.1"
            name="profitDropPercent"
            defaultValue={row?.profitDropPercent ?? ""}
            placeholder={`${placeholders.profitDropPercent}`}
            className="mt-1 flex h-10 w-full lg:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Triggers when today’s profit is lower than yesterday by more than this percentage.
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Expense Spike Alert (%)</label>
          <input
            type="number"
            step="1"
            name="expenseSpikePercent"
            defaultValue={row?.expenseSpikePercent ?? ""}
            placeholder={`${placeholders.expenseSpikePercent}`}
            className="mt-1 flex h-10 w-full lg:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Triggers when today’s expenses exceed the weekly average (excluding today) by more than this percentage.
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Cash Flow Alert (minimum negative amount)</label>
          <input
            type="number"
            step="100"
            name="cashFlowNegativeLimit"
            defaultValue={row?.cashFlowNegativeLimit ?? ""}
            placeholder={`${placeholders.cashFlowNegativeLimit}`}
            className="mt-1 flex h-10 w-full lg:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Triggers when net cash flow is negative and its absolute value exceeds this amount.
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Low Inventory Alert</label>
          <input
            type="number"
            step="1"
            name="inventoryBlockCount"
            defaultValue={row?.inventoryBlockCount ?? ""}
            placeholder={`${placeholders.inventoryBlockCount}`}
            className="mt-1 flex h-10 w-full lg:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Triggers when an inventory item’s quantity is at or below this number.
          </div>
        </div>
        <button type="submit" className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          Save
        </button>
      </form>
      <form action={resetToDefaults}>
        <button type="submit" className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          Reset to Defaults
        </button>
      </form>
    </div>
  );
}
