import { db } from "@/lib/db";
import { menuItems } from "@/db/schema/menu";
import { paymentMethods } from "@/db/schema/paymentMethods";
import Link from "next/link";
import SaleForm from "./SaleForm";
import { eq } from "drizzle-orm";
import { createSale } from "../createAction";

export default async function Page() {
  const menu = await db
    .select()
    .from(menuItems)
    .orderBy(menuItems.name);
  const methods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.isActive, true))
    .orderBy(paymentMethods.name);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Record Sale</h1>
        <Link className="underline" href="/sales">
          Back to Sales
        </Link>
      </div>
      <SaleForm
        action={createSale}
        menuItems={menu.map((m) => ({ id: m.id, name: m.name, price: m.price }))}
        paymentMethods={methods.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
