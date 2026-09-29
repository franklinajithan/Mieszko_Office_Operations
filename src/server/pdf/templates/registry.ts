import type { EmailOrder } from "@/lib/order-message";
import { toOrderPdfModel } from "../model";
import { renderDefaultOrderPdf } from "./default";
import { renderHounslowOrderPdf } from "./hounslow";
import { renderPerivaleOrderPdf } from "./perivale";

export type OrderPdfTemplateId = "default" | "perivale" | "hounslow";

export type StoreTemplateAssignment = {
  storeId?: string;
  storeCode?: string;
  templateId: OrderPdfTemplateId;
};

const templates = {
  default: renderDefaultOrderPdf,
  perivale: renderPerivaleOrderPdf,
  hounslow: renderHounslowOrderPdf,
};

export const STORE_TEMPLATE_ASSIGNMENTS: StoreTemplateAssignment[] = [];

export function resolveTemplateId(
  store: { id: string; code: string | null },
  assignments: StoreTemplateAssignment[] = STORE_TEMPLATE_ASSIGNMENTS,
): OrderPdfTemplateId {
  const byId = assignments.find((assignment) => assignment.storeId && assignment.storeId === store.id);
  if (byId && templates[byId.templateId]) return byId.templateId;
  const code = store.code?.trim().toLowerCase();
  const byCode = code ? assignments.find((assignment) => assignment.storeCode?.trim().toLowerCase() === code) : undefined;
  if (byCode && templates[byCode.templateId]) return byCode.templateId;
  return "default";
}

export function renderOrderPdfForStore(order: EmailOrder, assignments?: StoreTemplateAssignment[]) {
  const templateId = resolveTemplateId({ id: order.storeId, code: order.storeCode }, assignments);
  return templates[templateId](toOrderPdfModel(order));
}
