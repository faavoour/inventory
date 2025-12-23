import { db } from "@/lib/db";
import { inventoryItems } from "@/db/schema/inventory";
import { eq } from "drizzle-orm";
import { NewPrepItemForm } from "./NewPrepItemForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewPrepItemPage() {
  const rawIngredients = await db
    .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
        baseUnit: inventoryItems.baseUnit,
        costPerBaseUnit: inventoryItems.costPerBaseUnit
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.type, "RAW"))
    .orderBy(inventoryItems.name);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/prep" className="text-muted-foreground hover:text-foreground">
            &larr; Back to Prep Items
        </Link>
      </div>
      <div>
         <h1 className="text-2xl font-semibold">Add Prep Item</h1>
         <p className="text-muted-foreground">Create a new prep item and record its initial batch.</p>
      </div>
      <NewPrepItemForm rawIngredients={rawIngredients} />
    </div>
  );
}
