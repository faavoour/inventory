import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { inventoryItems, inventoryMovements } from "@/db/schema/inventory";
import { recipeItems, menuItems } from "@/db/schema/menu";
import { prepItems, prepInventory } from "@/db/schema/prep";
import { expenses } from "@/db/schema/expenses";
import { and, eq, gte, lt, sql, inArray } from "drizzle-orm";
import Link from "next/link";
import { getExpensePresets, salesRangeFromParams, expenseRangeFromParams } from "@/lib/dateRange";
import Charts from "./Charts";
import { paymentMethods } from "@/db/schema/paymentMethods";
import { expenseCategories } from "@/db/schema/expenseCategories";
import { paymentAllocations } from "@/db/schema/paymentAllocations";
import { alertSettings } from "@/db/schema/alertSettings";
import { fmtCurrencyNaira } from "@/lib/format";

type Insight = {
  level: "critical" | "warning" | "positive" | "info";
  title: string;
  message: string;
  details?: string[];
};

function clsFor(level: Insight["level"]) {
  if (level === "critical") return "border-destructive/20 bg-destructive/15 text-destructive";
  if (level === "warning") return "border-warning/20 bg-warning/15 text-warning";
  if (level === "positive") return "border-success/20 bg-success/15 text-success";
  return "border-border bg-card text-card-foreground";
}

export default async function Page() {
  const presets = getExpensePresets();
  const today = presets[0];
  const yesterday = presets[1];
  const thisWeek = presets[2];

  const srToday = salesRangeFromParams(today.start, today.end);
  const erToday = expenseRangeFromParams(today.start, today.end);
  const srYesterday = salesRangeFromParams(yesterday.start, yesterday.end);
  const erYesterday = expenseRangeFromParams(yesterday.start, yesterday.end);
  const erWeek = expenseRangeFromParams(thisWeek.start, thisWeek.end);

  const revenueRowsToday = await db
    .select({ price: saleItems.totalPrice })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, erToday.startStr!), lt(sales.saleDate, erToday.endExclusiveStr!)));
  const revenueToday = revenueRowsToday.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
  const movementRowsToday = await db
    .select({ change: inventoryMovements.changeAmount, costPerUnit: inventoryItems.costPerUnit })
    .from(inventoryMovements)
    .innerJoin(inventoryItems, eq(inventoryMovements.inventoryItemId, inventoryItems.id))
    .where(
      and(
        gte(inventoryMovements.createdAt, srToday.startDate!),
        lt(inventoryMovements.createdAt, srToday.endExclusiveDate!),
        sql`${inventoryMovements.type} = 'SALE' OR (${inventoryMovements.type} IS NULL AND ${inventoryMovements.changeAmount} < 0)`
      )
    );
  const cogsToday = movementRowsToday.reduce((sum, m) => sum + Math.abs(Number(m.change) || 0) * (Number(m.costPerUnit) || 0), 0);
  const expensesRowsToday = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, erToday.startStr!), lt(expenses.expenseDate, erToday.endExclusiveStr!)));
  const expensesToday = expensesRowsToday.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const profitToday = revenueToday - cogsToday - expensesToday;

  const revenueRowsYesterday = await db
    .select({ price: saleItems.totalPrice })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, erYesterday.startStr!), lt(sales.saleDate, erYesterday.endExclusiveStr!)));
  const revenueYesterday = revenueRowsYesterday.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
  const movementRowsYesterday = await db
    .select({ change: inventoryMovements.changeAmount, costPerUnit: inventoryItems.costPerUnit })
    .from(inventoryMovements)
    .innerJoin(inventoryItems, eq(inventoryMovements.inventoryItemId, inventoryItems.id))
    .where(
      and(
        gte(inventoryMovements.createdAt, srYesterday.startDate!),
        lt(inventoryMovements.createdAt, srYesterday.endExclusiveDate!),
        sql`${inventoryMovements.type} = 'SALE' OR (${inventoryMovements.type} IS NULL AND ${inventoryMovements.changeAmount} < 0)`
      )
    );
  const cogsYesterday = movementRowsYesterday.reduce((sum, m) => sum + Math.abs(Number(m.change) || 0) * (Number(m.costPerUnit) || 0), 0);
  const expensesRowsYesterday = await db
    .select({ amount: expenses.amount })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, erYesterday.startStr!), lt(expenses.expenseDate, erYesterday.endExclusiveStr!)));
  const expensesYesterday = expensesRowsYesterday.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const profitYesterday = revenueYesterday - cogsYesterday - expensesYesterday;

  const settingsRows = await db.select().from(alertSettings).limit(1);
  const cfg = settingsRows[0] || {
    profitDropPercent: 10,
    expenseSpikePercent: 150,
    cashFlowNegativeLimit: 10000,
    inventoryBlockCount: 2,
  };
  const dropPctThreshold = (Number(cfg.profitDropPercent) || 10) / 100;
  const spikePctThreshold = (Number(cfg.expenseSpikePercent) || 150) / 100;
  const cashFlowLimit = Number(cfg.cashFlowNegativeLimit) || 10000;
  const blockCount = Number(cfg.inventoryBlockCount) || 2;

  const insights: Insight[] = [];
  if (profitYesterday > 0) {
    const pct = (profitToday - profitYesterday) / profitYesterday;
    if (pct <= -dropPctThreshold) {
      insights.push({
        level: "warning",
        title: "Daily Profit",
        message: "Today’s profit is significantly lower than yesterday.",
      });
    } else if (pct >= dropPctThreshold) {
      insights.push({
        level: "positive",
        title: "Daily Profit",
        message: "Today’s profit improved compared to yesterday.",
      });
    }
  }

  const expensesRowsWeekExToday = await db
    .select({ amount: expenses.amount, d: expenses.expenseDate })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, erWeek.startStr!), lt(expenses.expenseDate, erToday.startStr!)));
  const byDay = new Map<string, number>();
  for (const r of expensesRowsWeekExToday) {
    const k = typeof r.d === "string" ? r.d : (r.d as Date).toISOString().slice(0, 10);
    const amt = Number(r.amount) || 0;
    byDay.set(k, (byDay.get(k) || 0) + amt);
  }
  const daysWithData = Array.from(byDay.values()).filter((x) => x > 0).length;
  const totalWeekExToday = Array.from(byDay.values()).reduce((sum, x) => sum + x, 0);
  const avgDailyWeekExToday = daysWithData > 0 ? totalWeekExToday / daysWithData : 0;
  if (daysWithData >= 2 && avgDailyWeekExToday > 0 && expensesToday > spikePctThreshold * avgDailyWeekExToday) {
    insights.push({
      level: "warning",
      title: "Expense Spike",
      message: "Expenses are unusually high today compared to this week.",
    });
  }

  const salesRowsToday = await db.select({ amount: sales.totalAmount }).from(sales).where(and(gte(sales.saleDate, erToday.startStr!), lt(sales.saleDate, erToday.endExclusiveStr!)));
  const totalSalesToday = salesRowsToday.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const netCashFlowToday = totalSalesToday - expensesToday;
  if (netCashFlowToday < -cashFlowLimit) {
    insights.push({
      level: "critical",
      title: "Cash Flow",
      message: "Cash flow is significantly negative for this period.",
    });
  }
  const salesRowsWeek = await db.select({ amount: sales.totalAmount }).from(sales).where(and(gte(sales.saleDate, erWeek.startStr!), lt(sales.saleDate, erWeek.endExclusiveStr!)));
  const totalSalesWeek = salesRowsWeek.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const netCashFlowWeek = totalSalesWeek - (totalWeekExToday + expensesToday);
  if (!(netCashFlowToday < -cashFlowLimit) && netCashFlowWeek < -cashFlowLimit) {
    insights.push({
      level: "critical",
      title: "Cash Flow",
      message: "Cash flow is significantly negative for this period.",
    });
  }

  const recipeRows = await db
    .select({
      inventoryItemId: recipeItems.inventoryItemId,
      prepItemId: recipeItems.prepItemId,
      menuItemId: recipeItems.menuItemId,
      quantityRequired: recipeItems.quantityRequired,
    })
    .from(recipeItems);
  const minRequiredByInventory = new Map<string, number>();
  const menuCountByInventory = new Map<string, number>();
  const minRequiredByPrep = new Map<string, number>();
  const menuCountByPrep = new Map<string, number>();

  for (const r of recipeRows) {
    if (r.inventoryItemId) {
      const invId = r.inventoryItemId;
      const req = Number(r.quantityRequired) || 0;
      const prevMin = minRequiredByInventory.get(invId);
      if (prevMin === undefined) {
        minRequiredByInventory.set(invId, req);
      } else {
        minRequiredByInventory.set(invId, Math.min(prevMin, req));
      }
      menuCountByInventory.set(invId, (menuCountByInventory.get(invId) || 0) + 1);
    }
    if (r.prepItemId) {
      const prepId = r.prepItemId;
      const req = Number(r.quantityRequired) || 0;
      const prevMin = minRequiredByPrep.get(prepId);
      if (prevMin === undefined) {
        minRequiredByPrep.set(prepId, req);
      } else {
        minRequiredByPrep.set(prepId, Math.min(prevMin, req));
      }
      menuCountByPrep.set(prepId, (menuCountByPrep.get(prepId) || 0) + 1);
    }
  }
  const invRows = await db.select().from(inventoryItems);
  const lowInventory: Array<{ name: string; quantity: number; required: number; menuCount: number }> = [];
  for (const i of invRows) {
    const minReq = minRequiredByInventory.get(i.id);
    const qty = Number(i.quantity) || 0;
    const cnt = menuCountByInventory.get(i.id) || 0;
    if (qty === 0 || (cnt >= blockCount && minReq !== undefined && qty < minReq)) {
      lowInventory.push({ name: i.name, quantity: qty, required: minReq ?? 0, menuCount: cnt });
    }
  }

  const prepRows = await db
    .select({
      id: prepItems.id,
      name: prepItems.name,
      baseQuantity: prepInventory.baseQuantity,
    })
    .from(prepItems)
    .leftJoin(prepInventory, eq(prepInventory.prepItemId, prepItems.id));

  for (const p of prepRows) {
    const minReq = minRequiredByPrep.get(p.id);
    const qty = Number(p.baseQuantity) || 0;
    const cnt = menuCountByPrep.get(p.id) || 0;
    if (qty === 0 || (cnt >= blockCount && minReq !== undefined && qty < minReq)) {
      lowInventory.push({ name: p.name, quantity: qty, required: minReq ?? 0, menuCount: cnt });
    }
  }
  if (lowInventory.length > 0) {
    insights.push({
      level: "critical",
      title: "Low Inventory",
      message: "Some inventory items may block menu availability.",
      details: lowInventory
        .slice(0, 6)
        .map((x) => `${x.name}: ${x.quantity}${x.required ? ` / min ${x.required}` : ""}${x.menuCount ? ` • uses: ${x.menuCount}` : ""}`),
    });
  }

  const ordered = insights.sort((a, b) => {
    const rank = (l: Insight["level"]) =>
      l === "critical" ? 3 : l === "warning" ? 2 : l === "positive" ? 1 : 0;
    return rank(b.level) - rank(a.level);
  }).slice(0, 5);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d: Date, days: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  };
  const base = new Date();
  const t = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const start7 = addDays(t, -6);
  const endExclusive7 = addDays(t, 1);
  const sr7 = { startDate: new Date(Date.UTC(start7.getFullYear(), start7.getMonth(), start7.getDate(), 0, 0, 0)), endExclusiveDate: new Date(Date.UTC(endExclusive7.getFullYear(), endExclusive7.getMonth(), endExclusive7.getDate(), 0, 0, 0)) };
  const er7 = { startStr: formatYMD(start7), endExclusiveStr: formatYMD(endExclusive7) };
  const days7: string[] = Array.from({ length: 7 }, (_, i) => formatYMD(addDays(start7, i)));
  const salesRows7 = await db.select({ d: sales.saleDate, amount: sales.totalAmount }).from(sales).where(and(gte(sales.saleDate, er7.startStr!), lt(sales.saleDate, er7.endExclusiveStr!)));
  const cogsRows7 = await db
    .select({ createdAt: inventoryMovements.createdAt, change: inventoryMovements.changeAmount, costPerUnit: inventoryItems.costPerUnit, type: inventoryMovements.type })
    .from(inventoryMovements)
    .innerJoin(inventoryItems, eq(inventoryMovements.inventoryItemId, inventoryItems.id))
    .where(and(gte(inventoryMovements.createdAt, sr7.startDate!), lt(inventoryMovements.createdAt, sr7.endExclusiveDate!)));
  const expensesRows7 = await db.select({ date: expenses.expenseDate, amount: expenses.amount }).from(expenses).where(and(gte(expenses.expenseDate, er7.startStr!), lt(expenses.expenseDate, er7.endExclusiveStr!)));
  const salesByDay = new Map<string, number>(days7.map((d) => [d, 0]));
  for (const s of salesRows7) {
    const k = typeof s.d === "string" ? (s.d as string) : (s.d as Date).toISOString().slice(0, 10);
    salesByDay.set(k, (salesByDay.get(k) || 0) + (Number(s.amount) || 0));
  }
  const cogsByDay = new Map<string, number>(days7.map((d) => [d, 0]));
  for (const c of cogsRows7) {
    const d = new Date(c.createdAt as Date);
    const k = formatYMD(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    const isSale = c.type === "SALE" || (c.type === null && (Number(c.change) || 0) < 0);
    if (isSale) {
      const amt = Math.abs(Number(c.change) || 0) * (Number(c.costPerUnit) || 0);
      cogsByDay.set(k, (cogsByDay.get(k) || 0) + amt);
    }
  }
  const expensesByDay = new Map<string, number>(days7.map((d) => [d, 0]));
  for (const e of expensesRows7) {
    const k = typeof e.date === "string" ? e.date : (e.date as Date).toISOString().slice(0, 10);
    expensesByDay.set(k, (expensesByDay.get(k) || 0) + (Number(e.amount) || 0));
  }
  const profitTrend = days7.map((d) => ({
    date: d,
    profit: (salesByDay.get(d) || 0) - (cogsByDay.get(d) || 0) - (expensesByDay.get(d) || 0),
  }));
  const salesVsExpenses = days7.map((d) => ({
    date: d,
    sales: salesByDay.get(d) || 0,
    expenses: expensesByDay.get(d) || 0,
  }));
  const categories = await db.select().from(expenseCategories).orderBy(expenseCategories.name);
  const categoryNameById = new Map<string, string>(categories.map((c) => [c.id, c.name]));
  const expWeekRows = await db.select().from(expenses).where(and(gte(expenses.expenseDate, erWeek.startStr!), lt(expenses.expenseDate, erWeek.endExclusiveStr!)));
  const breakdownMap = new Map<string, number>();
  for (const e of expWeekRows) {
    const name =
      (e.expenseCategoryId && categoryNameById.get(e.expenseCategoryId)) ||
      (e.category && e.category !== "—" ? e.category : "Uncategorized");
    const amt = Number(e.amount) || 0;
    breakdownMap.set(name, (breakdownMap.get(name) || 0) + amt);
  }
  const expenseBreakdown = Array.from(breakdownMap.entries())
    .filter(([, v]) => (v || 0) > 0)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const methods = await db.select().from(paymentMethods).where(eq(paymentMethods.isActive, true));
  const nameById = new Map(methods.map((m) => [m.id, m.name]));
  const salesWeekRows = await db.select().from(sales).where(and(gte(sales.saleDate, erWeek.startStr!), lt(sales.saleDate, erWeek.endExclusiveStr!)));
  const expensesWeekRows = await db.select().from(expenses).where(and(gte(expenses.expenseDate, erWeek.startStr!), lt(expenses.expenseDate, erWeek.endExclusiveStr!)));
  const saleIds = salesWeekRows.map((s) => s.id);
  const expenseIds = expensesWeekRows.map((e) => e.id);
  const saleAllocs = saleIds.length
    ? await db
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "SALE"), inArray(paymentAllocations.entityId, saleIds)))
    : [];
  const expenseAllocs = expenseIds.length
    ? await db
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "EXPENSE"), inArray(paymentAllocations.entityId, expenseIds)))
    : [];
  const salesTotalsByMethod = new Map<string, number>();
  for (const a of saleAllocs) {
    const nm = nameById.get(a.paymentMethodId) ?? "—";
    const amt = Number(a.amount) || 0;
    salesTotalsByMethod.set(nm, (salesTotalsByMethod.get(nm) || 0) + amt);
  }
  const expenseTotalsByMethod = new Map<string, number>();
  for (const a of expenseAllocs) {
    const nm = nameById.get(a.paymentMethodId) ?? "—";
    const amt = Number(a.amount) || 0;
    expenseTotalsByMethod.set(nm, (expenseTotalsByMethod.get(nm) || 0) + amt);
  }
  const cashFlowByMethod = Array.from(new Set([...salesTotalsByMethod.keys(), ...expenseTotalsByMethod.keys()]))
    .map((nm) => ({ name: nm, net: (salesTotalsByMethod.get(nm) || 0) - (expenseTotalsByMethod.get(nm) || 0) }))
    .filter((x) => x.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const aggRowsToday = await db
    .select({
      menuItemId: menuItems.id,
      name: menuItems.name,
      qty: sql<number>`sum(${saleItems.quantity})`,
      revenue: sql<number>`sum(${saleItems.totalPrice})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(menuItems, eq(saleItems.menuItemId, menuItems.id))
    .where(and(gte(sales.saleDate, erToday.startStr!), lt(sales.saleDate, erToday.endExclusiveStr!)))
    .groupBy(menuItems.id, menuItems.name);
  const unitCostsToday = await db
    .select({
      menuItemId: recipeItems.menuItemId,
      unitCost: sql<number>`sum(${recipeItems.quantityRequired} * ${inventoryItems.costPerUnit})`,
    })
    .from(recipeItems)
    .innerJoin(inventoryItems, eq(recipeItems.inventoryItemId, inventoryItems.id))
    .groupBy(recipeItems.menuItemId);
  const unitCostByMenuToday = new Map<string, number>(unitCostsToday.map((r) => [r.menuItemId as string, Number(r.unitCost) || 0]));
  const qtyTopToday = aggRowsToday
    .map((r) => ({ id: r.menuItemId as string, name: r.name ?? "—", qty: Number(r.qty) || 0 }))
    .filter((r) => r.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 1)[0];
  const profitTopToday = aggRowsToday
    .map((r) => {
      const id = r.menuItemId as string;
      const qty = Number(r.qty) || 0;
      const revenue = Number(r.revenue) || 0;
      const unitCost = unitCostByMenuToday.get(id) || 0;
      const profit = revenue - qty * unitCost;
      return { id, name: r.name ?? "—", profit };
    })
    .filter((r) => (r.profit || 0) > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 1)[0];

  const saleIdsTodayOnly = await db.select({ id: sales.id }).from(sales).where(and(gte(sales.saleDate, erToday.startStr!), lt(sales.saleDate, erToday.endExclusiveStr!)));
  const saleIdsSet = saleIdsTodayOnly.map((s) => s.id);
  const expenseIdsTodayOnly = await db.select({ id: expenses.id }).from(expenses).where(and(gte(expenses.expenseDate, erToday.startStr!), lt(expenses.expenseDate, erToday.endExclusiveStr!)));
  const expenseIdsSet = expenseIdsTodayOnly.map((e) => e.id);
  const saleAllocsTodayOnly = saleIdsSet.length
    ? await db
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "SALE"), inArray(paymentAllocations.entityId, saleIdsSet)))
    : [];
  const expenseAllocsTodayOnly = expenseIdsSet.length
    ? await db
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.entityType, "EXPENSE"), inArray(paymentAllocations.entityId, expenseIdsSet)))
    : [];
  const methodsAllToday = await db.select().from(paymentMethods);
  const methodInfoByIdToday = new Map(methodsAllToday.map((m) => [m.id, { name: m.name, isActive: !!m.isActive }]));
  const saleTotalsByIdToday = new Map<string, number>();
  for (const a of saleAllocsTodayOnly) {
    saleTotalsByIdToday.set(a.entityId, (saleTotalsByIdToday.get(a.entityId) || 0) + (Number(a.amount) || 0));
  }
  const expenseTotalsByIdToday = new Map<string, number>();
  for (const a of expenseAllocsTodayOnly) {
    expenseTotalsByIdToday.set(a.entityId, (expenseTotalsByIdToday.get(a.entityId) || 0) + (Number(a.amount) || 0));
  }
  const salesRowsTodayOnly = await db.select().from(sales).where(and(gte(sales.saleDate, erToday.startStr!), lt(sales.saleDate, erToday.endExclusiveStr!)));
  const splitMismatchCountSalesToday = salesRowsTodayOnly.filter((s) => Math.round((saleTotalsByIdToday.get(s.id) || 0) * 100) !== Math.round(Number(s.totalAmount || 0) * 100)).length;
  const expenseRowsTodayOnly = await db.select().from(expenses).where(and(gte(expenses.expenseDate, erToday.startStr!), lt(expenses.expenseDate, erToday.endExclusiveStr!)));
  const splitMismatchCountExpensesToday = expenseRowsTodayOnly.filter((e) => Math.round((expenseTotalsByIdToday.get(e.id) || 0) * 100) !== Math.round(Number(e.amount || 0) * 100)).length;
  const inactiveMethodUsedToday =
    saleAllocsTodayOnly.concat(expenseAllocsTodayOnly).some((a) => methodInfoByIdToday.get(a.paymentMethodId)?.isActive === false) || false;
  const uncategorizedExpensesToday = expenseRowsTodayOnly.filter((e) => !(e.expenseCategoryId || "") && (!e.category || e.category.trim().length === 0 || e.category === "—")).length;
  const alertsList: Array<{ level: "info" | "warning"; message: string }> = [];
  const totalSalesAmountToday = salesRowsToday.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  if (totalSalesAmountToday === 0) alertsList.push({ level: "info", message: "No sales today" });
  if (lowInventory.length > 0) alertsList.push({ level: "warning", message: "Inventory below recipe requirement for some items" });
  if (inactiveMethodUsedToday) alertsList.push({ level: "warning", message: "Deactivated payment method used today" });
  if (splitMismatchCountSalesToday + splitMismatchCountExpensesToday > 0) alertsList.push({ level: "warning", message: "Split payment mismatch detected today" });
  if (uncategorizedExpensesToday > 0) alertsList.push({ level: "warning", message: "Expenses missing category today" });

  const lowInventoryList = [];
  const outOfStockInvIds = invRows.filter((i) => (Number(i.quantity) || 0) === 0).map((i) => i.id);
  const affectedMenuIdSet = new Set<string>();
  for (const r of recipeRows) {
    if (outOfStockInvIds.includes(r.inventoryItemId as string)) {
      affectedMenuIdSet.add(r.menuItemId as string);
    }
  }
  const affectedMenuIds = [...affectedMenuIdSet];
  const affectedMenuNames = affectedMenuIds.length
    ? (await db.select().from(menuItems).where(inArray(menuItems.id, affectedMenuIds))).map((m) => m.name)
    : [];
  const inactiveMethodNames = Array.from(
    new Set(
      saleAllocsTodayOnly
        .concat(expenseAllocsTodayOnly)
        .filter((a) => methodInfoByIdToday.get(a.paymentMethodId)?.isActive === false)
        .map((a) => methodInfoByIdToday.get(a.paymentMethodId)?.name || "—")
    )
  );
  const inactiveCategories = await db.select().from(expenseCategories).where(eq(expenseCategories.isActive, false));
  const inactiveCategoryIdSet = new Set(inactiveCategories.map((c) => c.id));
  const inactiveCategoryNameById = new Map(inactiveCategories.map((c) => [c.id, c.name]));
  const expensesWithInactiveCategory = expenseRowsTodayOnly.filter((e) => !!e.expenseCategoryId && inactiveCategoryIdSet.has(e.expenseCategoryId as string));
  const inactiveCategoryNamesUsed = Array.from(
    new Set(
      expensesWithInactiveCategory
        .map((e) => inactiveCategoryNameById.get(e.expenseCategoryId as string))
        .filter((n) => !!n)
    )
  ) as string[];
  const cashInflowToday = revenueToday;
  const cashOutflowToday = expensesToday;
  const lowQtyThreshold = Number(cfg.inventoryBlockCount) || 2;
  const lowQtyItems = invRows
    .map((x) => ({ name: x.name, quantity: Number(x.quantity) || 0 }))
    .filter((x) => x.quantity <= lowQtyThreshold)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 12);
  const profitDropAlert =
    profitYesterday > 0 && (profitToday - profitYesterday) / profitYesterday <= -dropPctThreshold;
  const expenseSpikeAlert =
    daysWithData >= 2 && avgDailyWeekExToday > 0 && expensesToday > spikePctThreshold * avgDailyWeekExToday;
  const cashFlowNegativeAlert = netCashFlowToday < -cashFlowLimit;
  const qtyTopProfit = (() => {
    if (!qtyTopToday) return undefined;
    const row = aggRowsToday.find((r) => (r.menuItemId as string) === qtyTopToday.id);
    if (!row) return undefined;
    const qty = Number(row.qty) || 0;
    const revenue = Number(row.revenue) || 0;
    const unitCost = unitCostByMenuToday.get(qtyTopToday.id) || 0;
    const profit = revenue - qty * unitCost;
    return Math.round(profit);
  })();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Insights & Alerts</h1>
        <div className="text-sm text-muted-foreground">Smart signals and warnings from your business activity.</div>
      </div>
      <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-sm">
        <div className="font-medium mb-2">Insights</div>
        <div className="space-y-2 text-sm">
          <div>
            <div className="flex items-center justify-between">
              <div>Sales vs Yesterday</div>
              <div className="font-medium">{revenueToday >= revenueYesterday ? "up" : "down"}</div>
            </div>
            <div className="text-muted-foreground">{`Today ${fmtCurrencyNaira(revenueToday)} • Yesterday ${fmtCurrencyNaira(revenueYesterday)}`}</div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div>Expense Behavior</div>
              <div className="font-medium">{expensesToday >= avgDailyWeekExToday ? "above avg" : "below avg"}</div>
            </div>
            <div className="text-muted-foreground">{`Today ${fmtCurrencyNaira(expensesToday)} • 7-day avg ${fmtCurrencyNaira(avgDailyWeekExToday)}`}</div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div>Profit Health</div>
              <div className="font-medium">{profitToday >= 0 ? "positive" : "negative"}</div>
            </div>
            <div className="text-muted-foreground">{`Profit today ${fmtCurrencyNaira(profitToday)}`}</div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div>Top Performer Today</div>
              <div className="font-medium">{qtyTopToday ? qtyTopToday.name : "—"}</div>
            </div>
            <div className="text-muted-foreground">
              {qtyTopToday
                ? `Qty ${qtyTopToday.qty} • Profit ${fmtCurrencyNaira(qtyTopProfit ?? 0)}`
                : "—"}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div>Cash Flow Today</div>
              <div className="font-medium">{cashInflowToday - cashOutflowToday >= 0 ? "positive" : "negative"}</div>
            </div>
            <div className="text-muted-foreground">{`Inflow ${fmtCurrencyNaira(cashInflowToday)} • Outflow ${fmtCurrencyNaira(cashOutflowToday)}`}</div>
          </div>
        </div>
      </div>
      <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-sm">
        <div className="font-medium mb-2">Alerts</div>
        <div className="space-y-2 text-sm">
          {lowQtyItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div>Some inventory items are running low</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">
                {lowQtyItems.map((x) => `${x.name} — ${x.quantity} remaining`).join(", ")}
              </div>
            </div>
          )}
          {profitDropAlert && (
            <div>
              <div className="flex items-center justify-between">
                <div>Profit dropped significantly today</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">Today’s profit is much lower than yesterday.</div>
            </div>
          )}
          {expenseSpikeAlert && (
            <div>
              <div className="flex items-center justify-between">
                <div>Expenses are unusually high today</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">Today’s expenses are far above recent daily levels.</div>
            </div>
          )}
          {cashFlowNegativeAlert && (
            <div>
              <div className="flex items-center justify-between">
                <div>Negative cash flow detected today</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">Money outpaced money in today.</div>
            </div>
          )}
          {affectedMenuNames.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div>Critical Inventory</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">{`Out of stock affects: ${affectedMenuNames.join(", ")}`}</div>
            </div>
          )}
          {(splitMismatchCountSalesToday + splitMismatchCountExpensesToday) > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div>Payment Integrity</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">{`Unbalanced splits — Sales ${splitMismatchCountSalesToday}, Expenses ${splitMismatchCountExpensesToday}`}</div>
            </div>
          )}
          {inactiveMethodNames.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div>Configuration</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">{`Deactivated methods used: ${inactiveMethodNames.join(", ")}`}</div>
            </div>
          )}
          {inactiveCategoryNamesUsed.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div>Expense Hygiene</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">{`Inactive categories assigned: ${inactiveCategoryNamesUsed.join(", ")}`}</div>
            </div>
          )}
          {uncategorizedExpensesToday > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div>Expense Hygiene</div>
                <div className="px-2 py-0.5 rounded border border-warning/20 bg-warning/15 text-warning text-xs">warning</div>
              </div>
              <div className="text-muted-foreground">{`Missing category — ${uncategorizedExpensesToday} expense(s)`}</div>
            </div>
          )}
          {totalSalesAmountToday === 0 && (
            <div>
              <div className="flex items-center justify-between">
                <div>No Sales Today</div>
                <div className="px-2 py-0.5 rounded border border-border text-muted-foreground text-xs">info</div>
              </div>
              <div className="text-muted-foreground">No sales were recorded today.</div>
            </div>
          )}
          {lowQtyItems.length === 0 &&
            affectedMenuNames.length === 0 &&
            (splitMismatchCountSalesToday + splitMismatchCountExpensesToday) === 0 &&
            inactiveMethodNames.length === 0 &&
            uncategorizedExpensesToday === 0 &&
            !(totalSalesAmountToday === 0) &&
            !profitDropAlert &&
            !expenseSpikeAlert &&
            !cashFlowNegativeAlert && <div className="text-muted-foreground">No alerts</div>}
        </div>
      </div>
    </div>
  );
}
