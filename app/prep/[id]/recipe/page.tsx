import { db } from "@/lib/db";
import { prepItems, prepRecipes } from "@/db/schema/prep";
import { inventoryItems } from "@/db/schema/inventory";
import { eq, and } from "drizzle-orm";
import AddRecipeItemForm from "./AddRecipeItemForm";
import RemovePrepRecipeItemButton from "./RemovePrepRecipeItemButton";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatBaseQuantity } from "@/lib/baseUnitDisplay";
import { revalidatePath } from "next/cache";

type ActionState = { error?: string };

export async function addPrepRecipeItem(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";
  const prepItemId = String(formData.get("prepItemId") || "");
  const inventoryItemId = String(formData.get("inventoryItemId") || "");
  const qtyStr = String(formData.get("quantity") || "").trim();
  const quantity = Number(qtyStr);

  if (!prepItemId) return { error: "Invalid prep item id." };
  if (!inventoryItemId) return { error: "Select an ingredient." };
  if (Number.isNaN(quantity) || quantity <= 0)
    return { error: "Quantity must be greater than 0." };

  const [inv] = await db
    .select({
      id: inventoryItems.id,
      unitMultiplier: inventoryItems.unitMultiplier,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, inventoryItemId))
    .limit(1);

  if (!inv) return { error: "Inventory item not found." };

  // Convert Display Unit Quantity to Base Unit Quantity
  // e.g. User inputs 2 (kg), multiplier is 1000 -> 2000 (g)
  const requiredBaseQuantity = quantity * (inv.unitMultiplier || 1);

  // Check if already exists? (Optional, but good UX)
  // For now, let's just insert. If schema has constraints, it will throw.
  // Assuming multiple entries of same ingredient are allowed (e.g. added at different stages), 
  // but typically recipes list unique ingredients. 
  // Let's check if it exists and update? Or just insert?
  // The schema doesn't enforce uniqueness on (prepItemId, inventoryItemId). 
  // But logical uniqueness is better. 
  // Let's just insert for now to match other patterns, or if it duplicates, the user can remove one.

  await db.insert(prepRecipes).values({
    prepItemId,
    inventoryItemId,
    requiredBaseQuantity,
  });

  revalidatePath(`/prep/${prepItemId}/recipe`);
  return {};
}

export async function removePrepRecipeItem(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  
  // Get prepItemId for revalidation
  const [row] = await db
    .select({ prepItemId: prepRecipes.prepItemId })
    .from(prepRecipes)
    .where(eq(prepRecipes.id, id))
    .limit(1);

  if (row) {
    await db.delete(prepRecipes).where(eq(prepRecipes.id, id));
    revalidatePath(`/prep/${row.prepItemId}/recipe`);
  }
}

export default async function PrepRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [prepItem] = await db
    .select()
    .from(prepItems)
    .where(eq(prepItems.id, id))
    .limit(1);

  if (!prepItem) notFound();

  const recipeItems = await db
    .select({
      id: prepRecipes.id,
      invName: inventoryItems.name,
      reqBase: prepRecipes.requiredBaseQuantity,
      invBaseUnit: inventoryItems.baseUnit,
      invUnit: inventoryItems.unit,
    })
    .from(prepRecipes)
    .leftJoin(inventoryItems, eq(prepRecipes.inventoryItemId, inventoryItems.id))
    .where(eq(prepRecipes.prepItemId, id));

  const allInventory = await db.select({
    id: inventoryItems.id,
    name: inventoryItems.name,
    unit: inventoryItems.unit,
    baseUnit: inventoryItems.baseUnit,
  })
  .from(inventoryItems)
  .where(eq(inventoryItems.isActive, true));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/prep" className="text-muted-foreground hover:text-foreground">
            &larr; Back
        </Link>
        <h1 className="text-2xl font-bold">Recipe: {prepItem.name}</h1>
      </div>

      <div className="border rounded-lg">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b">
               <th className="h-12 px-4 text-left font-medium text-muted-foreground">Ingredient</th>
               <th className="h-12 px-4 text-left font-medium text-muted-foreground">Required</th>
               <th className="h-12 px-4 text-right font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {recipeItems.map(r => {
               const qtyDisplay = formatBaseQuantity(r.reqBase, r.invBaseUnit || r.invUnit);
               return (
                 <tr key={r.id} className="border-b">
                   <td className="p-4">{r.invName}</td>
                   <td className="p-4">{qtyDisplay}</td>
                   <td className="p-4 text-right">
                     <RemovePrepRecipeItemButton id={r.id} action={removePrepRecipeItem} />
                   </td>
                 </tr>
               );
            })}
             {recipeItems.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-muted-foreground">
                  No ingredients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddRecipeItemForm 
        prepItemId={id} 
        inventoryItems={allInventory} 
        action={addPrepRecipeItem}
      />
    </div>
  );
}
