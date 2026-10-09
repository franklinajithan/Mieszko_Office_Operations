export type StockMovementKind = "wastage" | "store_use" | "stock_adjustment" | "stock_take" | "transfer" | "credit_note_review" | "unknown";

function normalise(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[_–—-]/g, " ").replace(/\s+/g, " ");
}

/** Unknown reasons are held for review, never silently counted as wastage. */
export function classifyMspMovement(reason: string): StockMovementKind {
  const text = normalise(reason);
  if (!text) return "unknown";
  if (/store\s*use/.test(text)) return "store_use";
  if (/stock\s*(?:correction|adjustment|adj)\b/.test(text)) return "stock_adjustment";
  if (/stock\s*take\s*corrections?\b|stocktake\s*corrections?\b/.test(text)) return "stock_take";
  if (/transfer/.test(text)) return "transfer";
  if (/consider\s*as\s*credit\s*note|credit\s*note/.test(text)) return "credit_note_review";
  if (/\bdamaged?\b|out\s*of\s*date|\bexpired?\b/.test(text)) return "wastage";
  return "unknown";
}

export function isGenuineWastage(reason: string) {
  return classifyMspMovement(reason) === "wastage";
}
