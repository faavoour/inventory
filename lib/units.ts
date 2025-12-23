export type UnitCategory = "WEIGHT" | "VOLUME" | "COUNT";

export type UnitDefinition = {
  value: string;
  label: string;
  category: UnitCategory;
  toBase: number; // Factor to multiply by to get base unit
};

export const UNITS: UnitDefinition[] = [
  // WEIGHT (Base: g)
  { value: "g", label: "Gram (g)", category: "WEIGHT", toBase: 1 },
  { value: "kg", label: "Kilogram (kg)", category: "WEIGHT", toBase: 1000 },

  // VOLUME (Base: ml)
  { value: "ml", label: "Milliliter (ml)", category: "VOLUME", toBase: 1 },
  { value: "l", label: "Liter (l)", category: "VOLUME", toBase: 1000 },

  // COUNT (Base: pcs)
  { value: "pcs", label: "Pieces (pcs)", category: "COUNT", toBase: 1 },
];

export const BASE_UNITS: Record<UnitCategory, string> = {
  WEIGHT: "g",
  VOLUME: "ml",
  COUNT: "pcs",
};

export function getUnitDefinition(unit: string): UnitDefinition | undefined {
  return UNITS.find((u) => u.value === unit);
}

export function getBaseUnit(unit: string): string | null {
  const def = getUnitDefinition(unit);
  return def ? BASE_UNITS[def.category] : null;
}

export function getUnitMultiplier(unit: string): number {
  const def = getUnitDefinition(unit);
  return def ? def.toBase : 1;
}

export function convertToBase(quantity: number, unit: string): { quantity: number; unit: string } | null {
  const def = getUnitDefinition(unit);
  if (!def) return null; // Unknown unit, cannot convert
  
  const baseUnit = BASE_UNITS[def.category];
  const baseQuantity = quantity * def.toBase;
  
  return { quantity: baseQuantity, unit: baseUnit };
}

export function validateCompatibleUnits(unitA: string, unitB: string): boolean {
  const defA = getUnitDefinition(unitA);
  const defB = getUnitDefinition(unitB);
  
  // If either is unknown, assume compatible (or strict fail? User said "Block incompatible units")
  // Let's assume strict if both known. If unknown (legacy), maybe allow?
  // User said "NO free-text units allowed" for new stuff.
  // Existing data might have free text.
  // If one is undefined, we can't strictly validate category.
  if (!defA || !defB) return true; // Fallback for legacy
  
  return defA.category === defB.category;
}
