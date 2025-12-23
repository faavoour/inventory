import { db } from "@/lib/db";
import { menuItems } from "@/db/schema/menu";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import MenuList from "./_components/MenuList";

export async function deleteMenuItem(formData: FormData) {
  "use server";
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return;
  }
  await db.delete(menuItems).where(eq(menuItems.id, id));
  revalidatePath("/menu");
  redirect("/menu");
}

export default async function Page() {
  // Fetch all items sorted by name
  const items = await db
    .select()
    .from(menuItems)
    .orderBy(menuItems.name);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Menu</h1>
          <div className="text-sm text-muted-foreground">Manage menu items and their recipes.</div>
        </div>
        <Link
          className="hidden lg:inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          href="/menu/new"
        >
          Add Menu Item
        </Link>
      </div>

      <MenuList initialItems={items} deleteAction={deleteMenuItem} />
    </div>
  );
}
