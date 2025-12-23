import { db } from "@/lib/db";
import { menuItems } from "@/db/schema/menu";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import MenuForm from "./MenuForm";

type ActionState = { error?: string };

async function createMenuItem(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const priceStr = String(formData.get("price") || "").trim();
  const price = Number(priceStr);

  if (!name) return { error: "Name is required." };
  if (Number.isNaN(price) || price <= 0)
    return { error: "Price must be a positive number." };

  await db.insert(menuItems).values({ name, price });

  revalidatePath("/menu");
  redirect("/menu");
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Menu Item</h1>
        <Link className="underline" href="/menu">
          Back to Menu
        </Link>
      </div>
      <MenuForm action={createMenuItem} />
    </div>
  );
}
