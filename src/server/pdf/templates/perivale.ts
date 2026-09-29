import type { OrderPdfModel } from "../model";
import { renderDefaultOrderPdf } from "./default";

export function renderPerivaleOrderPdf(model: OrderPdfModel) {
  return renderDefaultOrderPdf(model);
}
