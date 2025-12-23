import { db } from "@/lib/db";
import { menuItems } from "@/db/schema/menu";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import EditMenuForm from "./EditMenuForm";

type ActionState = { error?: string };

async function updateMenuItem(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const priceStr = String(formData.get("price") || "").trim();
  const price = Number(priceStr);

  if (!id) return { error: "Invalid item id." };
  if (!name) return { error: "Name is required." };
  if (Number.isNaN(price) || price <= 0)
    return { error: "Price must be a positive number." };

  await db.update(menuItems).set({ name, price }).where(eq(menuItems.id, id));

  revalidatePath("/menu");
  redirect("/menu");
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, id))
    .limit(1);

  if (item.length === 0) {
    notFound();
  }

  const current = item[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Menu Item</h1>
        <Link className="underline" href="/menu">
          Back to Menu
        </Link>
      </div>
      <EditMenuForm current={{ id: current.id, name: current.name, price: current.price }} action={updateMenuItem} />
    </div>
  );
}
