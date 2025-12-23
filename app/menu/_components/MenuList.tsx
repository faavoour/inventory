"use client";

import { useState } from "react";
import Link from "next/link";
import DeleteButton from "../../inventory/_components/DeleteButton";
import { fmtCurrencyNaira } from "@/lib/format";

type MenuItem = {
  id: string;
  name: string;
  price: number | string;
};

type MenuListProps = {
  initialItems: MenuItem[];
  deleteAction: (formData: FormData) => Promise<void>;
};

export default function MenuList({ initialItems, deleteAction }: MenuListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = initialItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Search menu items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/25 p-8 text-center animate-in fade-in-50">
          <div className="text-center space-y-2">
            <div className="text-lg font-medium">No menu items found</div>
            <div className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search."
                : "Create menu items to link sales to inventory."}
            </div>
            {!searchQuery && (
              <Link
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-4"
                href="/menu/new"
              >
                Add Menu Item
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-md border border-border hidden lg:block">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Price</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td className="p-4 align-middle">{item.name}</td>
                      <td className="p-4 align-middle">{typeof item.price === "number" ? fmtCurrencyNaira(item.price) : item.price}</td>
                      <td className="p-4 align-middle flex items-center gap-2">
                        <Link
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                          href={`/menu/${item.id}/edit`}
                        >
                          Edit
                        </Link>
                        <Link
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                          href={`/menu/${item.id}/recipe`}
                        >
                          Manage Recipe
                        </Link>
                        <span className="inline-block">
                          <DeleteButton id={item.id} action={deleteMenuItemProxy} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-sm font-semibold">{item.price}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Availability depends on inventory</div>
                  <div className="text-xs text-muted-foreground">Inventory sufficiency: —</div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 w-full"
                    href={`/menu/${item.id}/edit`}
                  >
                    Edit
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 w-full"
                    href={`/menu/${item.id}/recipe`}
                  >
                    Manage Recipe
                  </Link>
                  <DeleteButton id={item.id} action={deleteMenuItemProxy} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  async function deleteMenuItemProxy(formData: FormData) {
      await deleteAction(formData);
  }
}
