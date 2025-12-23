'use client';

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { fmtCurrencyNaira } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import DeleteSaleButton from "./DeleteSaleButton";
import { deleteSale } from "../actions";

type SaleRow = {
  id: string;
  createdAt: Date;
  totalAmount: number;
  paymentMethodName: string;
  items: string[];
  allocations: { methodName: string; amount: number }[];
};

type PaymentMethod = {
  id: string;
  name: string;
};

export default function SalesTable({
  rows,
  paymentMethods,
  currentMethodId,
}: {
  rows: SaleRow[];
  paymentMethods: PaymentMethod[];
  currentMethodId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleMethodChange = (newMethodId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newMethodId && newMethodId !== "All") {
      params.set("methodId", newMethodId);
    } else {
      params.delete("methodId");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Date
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Items
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Total
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Payment Method</span>
                    <select
                      className="h-8 w-[150px] rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={currentMethodId}
                      onChange={(e) => handleMethodChange(e.target.value)}
                    >
                      <option value="All">All</option>
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No sales found.
                  </td>
                </tr>
              ) : (
                rows.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="p-4 align-middle">
                      <span className="text-sm font-medium">
                        {formatDateTime(sale.createdAt)}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      {sale.items.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sale.items.map((item, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 align-middle font-medium">
                      {fmtCurrencyNaira(sale.totalAmount)}
                    </td>
                    <td className="p-4 align-middle">
                      {sale.paymentMethodName}
                    </td>
                    <td className="p-4 align-middle">
                      <DeleteSaleButton id={sale.id} action={deleteSale} />
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
