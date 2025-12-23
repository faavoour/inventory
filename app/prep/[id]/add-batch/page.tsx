import { db } from "@/lib/db";
import { prepItems, prepRecipes } from "@/db/schema/prep";
import { inventoryItems } from "@/db/schema/inventory";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import AddBatchForm from "./AddBatchForm";

export default async function AddBatchPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  const [prepItem] = await db
    .select({
        id: prepItems.id,
        name: prepItems.name,
        baseUnit: prepItems.baseUnit,
    })
    .from(prepItems)
    .where(eq(prepItems.id, id));

  if (!prepItem) notFound();

  const recipe = await db
    .select({
      inventoryItemId: prepRecipes.inventoryItemId,
      inventoryItemName: inventoryItems.name,
      inventoryItemUnit: sql<string>`COALESCE(${inventoryItems.baseUnit}, ${inventoryItems.unit})`,
      baseQuantity: prepRecipes.requiredBaseQuantity,
    })
    .from(prepRecipes)
    .innerJoin(inventoryItems, eq(prepRecipes.inventoryItemId, inventoryItems.id))
    .where(eq(prepRecipes.prepItemId, id));

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Add New Batch</h1>
        <p className="text-muted-foreground mt-2">
            Record a new production batch for <span className="font-semibold text-foreground">{prepItem.name}</span>. 
            This will deduct raw ingredients and update prep inventory.
        </p>
      </div>
      <AddBatchForm prepItem={prepItem} recipe={recipe} />
    </div>
  );
}
