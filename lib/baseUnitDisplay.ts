export function formatBaseQuantity(
  baseQuantity: number | null | undefined,
  baseUnit: string | null | undefined,
  precision = 2
): string {
  const qty = Number(baseQuantity) || 0;
  const unit = baseUnit || "";
  
  // Strip trailing zeros after decimal point for cleaner look (e.g. 100.00 -> 100)
  const formattedQty = Number(qty.toFixed(precision));
  
  return `${formattedQty} ${unit}`;
}
