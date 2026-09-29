import type { EmailOrder } from "@/lib/order-message";
import { renderOrderPdfForStore } from "./templates/registry";

export function renderOrderPdf(order: EmailOrder) {
  return renderOrderPdfForStore(order);
}
