export type QuantityLine = {
  quantity: number;
};

export function summarize(lines: QuantityLine[]) {
  const ordered = lines.filter((line) => line.quantity > 0);
  return {
    products: ordered.length,
    quantity: ordered.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export function isWholeQuantity(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

export function sendBlockReason(input: {
  status: string;
  deliveryDate: string | null;
  lines: { quantity: number }[];
}) {
  if (input.status === "submitted") return "This order has already been sent.";
  if (input.status === "cancelled") return "This order has been cancelled.";
  if (input.status !== "draft") return "This order can no longer be sent.";
  if (!input.deliveryDate) return "Please select a delivery date.";
  if (!input.lines.some((line) => line.quantity > 0)) return "Please enter at least one product quantity.";
  return null;
}

export function orderSubject(shop: string, supplier: string, deliveryDateLabel: string) {
  return `Mieszko Order - ${shop} - ${supplier} - Delivery ${deliveryDateLabel}`;
}

export function shopCopySubject(shop: string, supplier: string, deliveryDateLabel: string) {
  return `Copy: ${orderSubject(shop, supplier, deliveryDateLabel)}`;
}

export function productMatches(product: {
  name: string;
  polishName?: string | null;
  itemCode: string | null;
  ean: string | null;
  supplierCode: string | null;
}, term: string) {
  const query = term.trim().toLowerCase();
  if (!query) return true;
  return [product.itemCode, product.ean, product.supplierCode, product.name, product.polishName].some((value) => value?.toLowerCase().includes(query));
}
