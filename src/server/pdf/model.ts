import type { EmailOrder } from "@/lib/order-message";
import { orderedLines, orderTotals } from "@/lib/order-message";
import { formatUkDate } from "@/lib/format";

export type OrderPdfLine = {
  itemCode: string;
  ean: string;
  supplierCode: string;
  name: string;
  polishName: string | null;
  quantity: number;
};

export type OrderPdfModel = {
  storeId: string;
  storeCode: string | null;
  storeName: string;
  supplierName: string;
  deliveryDate: string;
  orderDate: string;
  orderNumber: string;
  lines: OrderPdfLine[];
  totalProducts: number;
  totalQty: number;
};

export function toOrderPdfModel(order: EmailOrder): OrderPdfModel {
  const lines = orderedLines(order.lines);
  const totals = orderTotals(order.lines);
  return {
    storeId: order.storeId,
    storeCode: order.storeCode,
    storeName: order.storeName,
    supplierName: order.supplierName,
    deliveryDate: formatUkDate(order.deliveryDate),
    orderDate: formatUkDate(order.orderDate),
    orderNumber: order.id,
    lines: lines.map((line) => ({
      itemCode: line.itemCode || "—",
      ean: line.ean || "—",
      supplierCode: line.supplierCode || "—",
      name: line.name,
      polishName: line.polishName?.trim() || null,
      quantity: line.quantity,
    })),
    totalProducts: totals.products,
    totalQty: totals.quantity,
  };
}
