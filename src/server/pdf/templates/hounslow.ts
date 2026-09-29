import type { OrderPdfModel } from "../model";
import { renderDefaultOrderPdf } from "./default";

export function renderHounslowOrderPdf(model: OrderPdfModel) {
  return renderDefaultOrderPdf(model);
}
