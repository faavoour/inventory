import { db } from "@/lib/db";
import { auditLogs } from "@/db/schema/auditLogs";
import { desc, and, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import { menuItems } from "@/db/schema/menu";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { expenseCategories } from "@/db/schema/expenseCategories";
import { inventoryItems } from "@/db/schema/inventory";
import { suppliers } from "@/db/schema/suppliers";
import { fmtCurrencyNaira } from "@/lib/format";
import DatePresets from "@/components/filters/DatePresets";
import { getExpensePresets } from "@/lib/dateRange";

type JsonObj = Record<string, unknown> | null | undefined;

function val(o: JsonObj, key: string): unknown {
  if (!o || typeof o !== "object") return undefined;
  return (o as Record<string, unknown>)[key];
}

function numVal(o: JsonObj, key: string): number | undefined {
  const v = val(o, key);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function strVal(o: JsonObj, key: string): string | undefined {
  const v = val(o, key);
  return typeof v === "string" ? v : undefined;
}

function summarize(
  row: {
    entityType: string;
    action: string;
    beforeData: JsonObj;
    afterData: JsonObj;
  },
  itemNameById?: Map<string, string>,
  paymentMethodNameById?: Map<string, string>,
  expenseCategoryNameById?: Map<string, string>,
  inventoryItemNameById?: Map<string, string>,
  supplierNameById?: Map<string, string>
) {
  const t = row.entityType;
  const a = row.action;
  if (t === "SALE") {
    if (a === "CREATE") {
      const total = numVal(row.afterData, "totalAmount");
      const allocsVal = val(row.afterData, "allocations");
      let pmText = "Unknown";
      if (Array.isArray(allocsVal)) {
        const parts: string[] = [];
        for (const it of allocsVal) {
          if (it && typeof it === "object") {
            const obj = it as Record<string, unknown>;
            const pmId = obj["paymentMethodId"];
            const amount = obj["amount"];
            const amt = typeof amount === "number" ? amount : typeof amount === "string" ? Number(amount) : undefined;
            const name = typeof pmId === "string" ? paymentMethodNameById?.get(pmId) ?? "Unknown" : "Unknown";
            if (name) parts.push(amt !== undefined ? `${name} (${fmtCurrencyNaira(amt)})` : name);
          }
        }
        if (parts.length > 0) {
          pmText = parts.join(" + ");
        }
      } else {
        const pmId = strVal(row.afterData, "paymentMethodId");
        const pmNameExplicit =
          strVal(row.afterData, "paymentMethodName") ?? strVal(row.afterData, "paymentMethod");
        pmText =
          pmNameExplicit ??
          (pmId && paymentMethodNameById?.get(pmId)) ??
          "Unknown";
      }
      const itemsVal = val(row.afterData, "items");
      const names: string[] = [];
      if (Array.isArray(itemsVal)) {
        for (const it of itemsVal) {
          if (it && typeof it === "object") {
            const id = (it as Record<string, unknown>)["menuItemId"];
            if (typeof id === "string") {
              const nm = itemNameById?.get(id);
              if (nm) names.push(nm);
            }
          }
        }
      }
      const itemsSuffix =
        names.length > 0 ? ` (${names.join(", ")})` : " (items unavailable)";
      return `Sale recorded: ${total !== undefined ? fmtCurrencyNaira(total) : "₦?"} via ${pmText}${itemsSuffix}`;
    }
    if (a === "DELETE") {
      const total = numVal(row.beforeData, "totalAmount");
      const allocsVal = val(row.beforeData, "allocations");
      let pmText = undefined as string | undefined;
      if (Array.isArray(allocsVal)) {
        const parts: string[] = [];
        for (const it of allocsVal) {
          if (it && typeof it === "object") {
            const obj = it as Record<string, unknown>;
            const pmId = obj["paymentMethodId"];
            const amount = obj["amount"];
            const amt = typeof amount === "number" ? amount : typeof amount === "string" ? Number(amount) : undefined;
            const name = typeof pmId === "string" ? paymentMethodNameById?.get(pmId) ?? "Unknown" : "Unknown";
            if (name) parts.push(amt !== undefined ? `${name} (${fmtCurrencyNaira(amt)})` : name);
          }
        }
        if (parts.length > 0) {
          pmText = parts.join(" + ");
        }
      }
      const itemsVal = val(row.beforeData, "items");
      const names: string[] = [];
      if (Array.isArray(itemsVal)) {
        for (const it of itemsVal) {
          if (it && typeof it === "object") {
            const id = (it as Record<string, unknown>)["menuItemId"];
            if (typeof id === "string") {
              const nm = itemNameById?.get(id);
              if (nm) names.push(nm);
            }
          }
        }
      }
      const itemsText =
        names.length > 0 ? names.join(", ") : "items unavailable";
      return `Sale deleted: ${total !== undefined ? fmtCurrencyNaira(total) : "₦?"}${pmText ? ` via ${pmText}` : ""} (${itemsText})`;
    }
    if (a === "UPDATE") {
      const msgs: string[] = [];
      const bt = numVal(row.beforeData, "totalAmount");
      const at = numVal(row.afterData, "totalAmount");
      if (bt !== undefined && at !== undefined && bt !== at) {
        msgs.push(`Total changed from ${fmtCurrencyNaira(bt)} → ${fmtCurrencyNaira(at)}`);
      }
      const bAlloc = val(row.beforeData, "allocations");
      const aAlloc = val(row.afterData, "allocations");
      const fmtAlloc = (arr: unknown) => {
        const parts: string[] = [];
        if (Array.isArray(arr)) {
          for (const it of arr) {
            if (it && typeof it === "object") {
              const obj = it as Record<string, unknown>;
              const pmId = obj["paymentMethodId"];
              const amount = obj["amount"];
              const amt = typeof amount === "number" ? amount : typeof amount === "string" ? Number(amount) : undefined;
              const name = typeof pmId === "string" ? paymentMethodNameById?.get(pmId) ?? "Unknown" : "Unknown";
              if (name) parts.push(amt !== undefined ? `${name} (${fmtCurrencyNaira(amt)})` : name);
            }
          }
        }
        return parts.join(" + ");
      };
      const bAllocText = fmtAlloc(bAlloc);
      const aAllocText = fmtAlloc(aAlloc);
      if (bAllocText && aAllocText && bAllocText !== aAllocText) {
        msgs.push(`Payment allocations updated: ${bAllocText} → ${aAllocText}`);
      }
      const beforeItemsVal = val(row.beforeData, "items");
      const afterItemsVal = val(row.afterData, "items");
      const beforeItems =
        Array.isArray(beforeItemsVal) ? (beforeItemsVal as Array<unknown>) : undefined;
      const afterItems =
        Array.isArray(afterItemsVal) ? (afterItemsVal as Array<unknown>) : undefined;
      function itemsMap(arr: Array<unknown> | undefined) {
        const m = new Map<string, number>();
        if (!arr) return m;
        for (const it of arr) {
          if (it && typeof it === "object") {
            const obj = it as Record<string, unknown>;
            const id = obj["menuItemId"];
            const qty = obj["quantity"];
            if (typeof id === "string") {
              const qn =
                typeof qty === "number"
                  ? qty
                  : typeof qty === "string"
                  ? Number(qty)
                  : undefined;
              if (qn !== undefined && !Number.isNaN(qn)) {
                m.set(id, qn);
              }
            }
          }
        }
        return m;
      }
      const bm = itemsMap(beforeItems);
      const am = itemsMap(afterItems);
      const changedIds: string[] = [];
      const allIds = new Set<string>([...bm.keys(), ...am.keys()]);
      for (const id of allIds) {
        if (!bm.has(id) || !am.has(id) || bm.get(id) !== am.get(id)) {
          changedIds.push(id);
        }
      }
      if (changedIds.length > 0) {
        const changedNames = changedIds.map(id => itemNameById?.get(id) || "Unknown Item");
        msgs.push(`Items updated: ${changedNames.join(", ")}`);
      }
      return msgs.length > 0 ? `Sale updated: ${msgs.join("; ")}` : "Sale updated (no details)";
    }
  }
  if (t === "EXPENSE") {
    if (a === "CREATE") {
      const amt = numVal(row.afterData, "amount");
      const cat = strVal(row.afterData, "category") ?? "Uncategorized";
      const title = strVal(row.afterData, "title") ?? "";
      return `Expense recorded: ${fmtCurrencyNaira(amt ?? 0)} for ${cat} - ${title}`;
    }
    if (a === "DELETE") {
      const amt = numVal(row.beforeData, "amount");
      const cat = strVal(row.beforeData, "category") ?? "Uncategorized";
      const title = strVal(row.beforeData, "title") ?? "";
      return `Expense deleted: ${fmtCurrencyNaira(amt ?? 0)} for ${cat} - ${title}`;
    }
    if (a === "UPDATE") {
      return "Expense updated";
    }
  }
  if (t === "INVENTORY_ITEM") {
    if (a === "CREATE") {
      const name = strVal(row.afterData, "name") ?? "Unknown";
      const qty = numVal(row.afterData, "quantity");
      return `Inventory item created: ${name} (Initial Qty: ${qty})`;
    }
    if (a === "UPDATE") {
      const name = strVal(row.afterData, "name") ?? "Unknown";
      const bq = numVal(row.beforeData, "quantity");
      const aq = numVal(row.afterData, "quantity");
      if (bq !== undefined && aq !== undefined && bq !== aq) {
        return `Inventory item updated: ${name} (Qty: ${bq} → ${aq})`;
      }
      return `Inventory item updated: ${name}`;
    }
    if (a === "DELETE") {
      const name = strVal(row.beforeData, "name") ?? "Unknown";
      return `Inventory item deleted: ${name}`;
    }
  }
  if (t === "SYSTEM_RESET") {
    return "System Reset Performed: Data Cleared";
  }
  return `${t} ${a}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const start = params?.start;
  const end = params?.end;

  const presets = getExpensePresets();
  const todayPreset = presets[0];
  const effectiveStart = start && start.length > 0 ? start : todayPreset.start;
  const effectiveEnd = end && end.length > 0 ? end : todayPreset.end;

  // Add one day to end for exclusive range
  const endDateObj = new Date(effectiveEnd);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endStr = endDateObj.toISOString().split("T")[0];

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(gte(auditLogs.createdAt, new Date(effectiveStart)), lt(auditLogs.createdAt, new Date(endStr))))
    .orderBy(desc(auditLogs.createdAt));

  const items = await db.select().from(menuItems);
  const methods = await db.select().from(paymentMethods);
  const cats = await db.select().from(expenseCategories);
  const inv = await db.select().from(inventoryItems);
  const supp = await db.select().from(suppliers);

  const itemNameById = new Map(items.map((i) => [i.id, i.name]));
  const paymentMethodNameById = new Map(methods.map((m) => [m.id, m.name]));
  const expenseCategoryNameById = new Map(cats.map((c) => [c.id, c.name]));
  const inventoryItemNameById = new Map(inv.map((i) => [i.id, i.name]));
  const supplierNameById = new Map(supp.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <Link className="text-primary hover:underline w-fit" href="/settings">
          ← Back to Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Audit Logs</h1>
            <div className="text-sm text-muted-foreground">View system activity and changes.</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
        <DatePresets presets={presets} />
      </div>

      <div className="rounded-md border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Entity</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Action</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No logs found.
                  </td>
                </tr>
              ) : (
                rows.map((log) => (
                  <tr key={log.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle whitespace-nowrap">
                      {log.createdAt.toLocaleDateString()} <span className="text-xs text-muted-foreground">{log.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="p-4 align-middle font-medium">{log.entityType}</td>
                    <td className="p-4 align-middle">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        log.action === "CREATE" ? "bg-success/15 text-success" :
                        log.action === "DELETE" ? "bg-destructive/15 text-destructive" :
                        "bg-secondary text-secondary-foreground"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 align-middle max-w-lg break-words">
                      {summarize(
                        log as any,
                        itemNameById,
                        paymentMethodNameById,
                        expenseCategoryNameById,
                        inventoryItemNameById,
                        supplierNameById
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
