import { db } from "@/lib/db";
import { sales, saleItems } from "@/db/schema/sales";
import { menuItems } from "@/db/schema/menu";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .limit(1);
  if (rows.length === 0) {
    notFound();
  }
  const sale = rows[0];

  const items = await db
    .select({
      id: saleItems.id,
      name: menuItems.name,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      totalPrice: saleItems.totalPrice,
    })
    .from(saleItems)
    .innerJoin(menuItems, eq(saleItems.menuItemId, menuItems.id))
    .where(eq(saleItems.saleId, id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sale Details</h1>
        <Link className="underline" href="/sales">
          Back to Sales
        </Link>
      </div>

      <div className="space-y-1">
        <div>Date: {String(sale.saleDate)}</div>
        <div>Total Amount: {sale.totalAmount}</div>
      </div>

      {items.length === 0 ? (
        <div className="text-muted-foreground">No items</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 border-b border-border">Item</th>
                <th className="text-left p-2 border-b border-border">Quantity</th>
                <th className="text-left p-2 border-b border-border">Unit Price</th>
                <th className="text-left p-2 border-b border-border">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-border">
                  <td className="p-2">{i.name}</td>
                  <td className="p-2">{i.quantity}</td>
                  <td className="p-2">{i.unitPrice}</td>
                  <td className="p-2">{i.totalPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
