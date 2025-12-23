import Link from "next/link";
import ResetAction from "./ResetAction";
import { 
  resetInventory, 
  resetSales, 
  resetExpenses, 
  resetMenu, 
  resetSuppliers, 
  resetMethods, 
  resetCategories, 
  resetLogs, 
  resetAll 
} from "./server-actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const salesDone = params?.sales;
  const expensesDone = params?.expenses;
  const inventoryDone = params?.inventory;
  const menuDone = params?.menu;
  const methodsDone = params?.methods;
  const categoriesDone = params?.categories;
  const logsDone = params?.logs;
  const suppliersDone = params?.suppliers;
  const prepDone = params?.prep;
  const allDone = params?.all;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="underline" href="/settings">
            ← Back to Settings
          </Link>
          <h1 className="text-xl font-semibold">Reset Center</h1>
        </div>
        <Link className="underline" href="/settings/reset-system">
          Refresh
        </Link>
      </div>

      {(salesDone || expensesDone || inventoryDone || menuDone || methodsDone || categoriesDone || logsDone || suppliersDone || prepDone || allDone) && (
        <div className="border border-success/20 bg-success/15 text-success p-3 rounded-md text-sm">
          {salesDone && "Sales records cleared."}
          {expensesDone && " Expenses records cleared."}
          {inventoryDone && " Inventory records cleared."}
          {menuDone && " Menu and recipes cleared."}
          {methodsDone && " Payment methods cleared."}
          {categoriesDone && " Expense categories cleared."}
          {logsDone && " Audit logs cleared."}
          {suppliersDone && " Suppliers cleared."}
          {prepDone && " Prep items cleared."}
          {allDone && " All data cleared."}
        </div>
      )}

      <div className="space-y-3">
        <div className="text-lg font-medium">Individual Resets</div>
        
        <form action={resetSales}>
          <ResetAction label="Sales" description="Deletes all sales and related items and allocations." />
        </form>

        <form action={resetExpenses}>
          <ResetAction label="Expenses" description="Deletes all expenses and related allocations." />
        </form>

        <form action={resetInventory}>
          <ResetAction label="Inventory" description="Deletes all inventory items, prep items, and movements." />
        </form>
        
        <form action={resetMenu}>
          <ResetAction label="Menu & Recipes" description="Deletes all menu items and their recipes." />
        </form>

        <form action={resetMethods}>
          <ResetAction label="Payment Methods" description="Deletes all payment methods." />
        </form>

        <form action={resetCategories}>
          <ResetAction label="Expense Categories" description="Deletes all expense categories." />
        </form>

        <form action={resetSuppliers}>
          <ResetAction label="Suppliers" description="Deletes all suppliers." />
        </form>

        <form action={resetLogs}>
          <ResetAction label="Audit Logs" description="Deletes all audit logs." />
        </form>
      </div>

      <div className="border-t border-border pt-4 mt-4 space-y-3">
        <div className="text-lg font-medium text-destructive">Full System Reset</div>
        <div className="text-xs text-muted-foreground">Irreversible. Deletes all records across the system.</div>
        <form action={resetAll}>
          <ResetAction label="Reset All Data" description="Permanently deletes all datasets. Use with caution." />
        </form>
      </div>
    </div>
  );
}
