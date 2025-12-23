export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

// Deprecated: Alias to formatCurrency to support existing usages until migration
export const fmtCurrencyNaira = formatCurrency;

export function normalizeNumericInput(
  value: string,
  options?: { allowDecimal?: boolean }
) {
  const allowDecimal = options?.allowDecimal ?? true;
  let v = String(value).trim();
  if (v === "") return "";
  v = v.replace(/[^\d.]/g, "");
  if (!allowDecimal) v = v.replace(/\./g, "");
  const parts = v.split(".");
  const intPart = parts[0] ?? "";
  const decPart = allowDecimal && parts.length > 1 ? parts.slice(1).join("") : undefined;
  const intNorm = intPart.replace(/^0+(?=\d)/, "");
  let out = intNorm === "" ? "0" : intNorm;
  if (allowDecimal && decPart !== undefined) out += `.${decPart}`;
  return out;
}
