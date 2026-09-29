import "server-only";
import { Resend } from "resend";
import { dispatchOrderEmails, type DispatchTarget, type OutboundEmail } from "@/lib/order-dispatch";
import { orderPdfFilename } from "@/lib/order-message";
import { writeAudit } from "./audit";
import { db } from "./db";
import { isMissingRelation, logServerError } from "./errors";
import { renderOrderPdf } from "./pdf/render-order-pdf";
import type { OrderDetail } from "./queries";
import type { Staff } from "./session";

export type EmailResult = {
  supplierStatus: "sent" | "failed" | "skipped";
  shopStatus: "sent" | "failed" | "missing" | "skipped";
  error?: string;
};

async function sendWithResend(message: OutboundEmail) {
  const from = process.env.ORDER_FROM_EMAIL?.trim();
  if (!from || !process.env.RESEND_API_KEY) return { error: "Email is not configured." };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const sent = await resend.emails.send({
    from,
    to: [message.to],
    cc: message.cc.length ? message.cc : undefined,
    subject: message.subject,
    html: message.html,
    attachments: message.attachments.map((file) => ({
      filename: file.filename,
      content: Buffer.from(file.content),
    })),
  });
  if (sent.error) logServerError("order email", sent.error.message);
  return { id: sent.data?.id ?? null, error: sent.error?.message ?? null };
}

async function insertEmailLog(input: {
  order: OrderDetail;
  staff: Staff;
  kind: "supplier_order" | "shop_order_copy";
  recipient: string | null;
  cc: string[];
  subject: string;
  status: string;
  providerId: string | null;
  error?: string;
}) {
  const { error } = await db().from("order_email_log").insert({
    order_id: input.order.id,
    supplier_id: input.order.supplierId,
    order_date: input.order.orderDate || null,
    kind: input.kind,
    recipient: input.recipient,
    cc: input.cc,
    subject: input.subject,
    status: input.status,
    provider_message_id: input.providerId,
    error_message: input.error ?? null,
    sent_by: input.staff.userId,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
  });
  if (error && !isMissingRelation(error)) logServerError("email log", error.message);
}

export async function deliverOrderEmail(
  order: OrderDetail,
  staff: Staff,
  options?: { target?: DispatchTarget; auditAction?: string },
): Promise<EmailResult> {
  const target = options?.target ?? "both";
  const from = process.env.ORDER_FROM_EMAIL?.trim() || null;
  const configured = Boolean(from && process.env.RESEND_API_KEY);
  const result = await dispatchOrderEmails({
    order,
    from: configured ? from : null,
    target,
    send: sendWithResend,
    renderPdf: async (current) => ({
      filename: orderPdfFilename(current),
      content: await renderOrderPdf(current),
    }),
  });

  if (result.updateSupplierStatus) {
    await insertEmailLog({
      order,
      staff,
      kind: "supplier_order",
      recipient: result.supplier.recipient,
      cc: result.supplier.cc,
      subject: result.supplier.subject,
      status: result.supplier.status,
      providerId: result.supplier.providerId,
      error: result.supplier.error,
    });
    const status = result.supplier.status === "sent" ? "sent" : "failed";
    const updated = await db().from("orders").update({ email_status: status }).eq("id", order.id);
    if (updated.error) logServerError("email status", updated.error.message);
    await writeAudit({
      staff,
      action: status === "sent" ? (options?.auditAction || "order_sent") : "order_email_failed",
      entityType: "order",
      entityId: order.id,
      storeId: order.storeId,
      metadata: { supplier_id: order.supplierId, kind: "supplier_order" },
    });
  }

  if (result.updateShopStatus) {
    await insertEmailLog({
      order,
      staff,
      kind: "shop_order_copy",
      recipient: result.shop.recipient,
      cc: [],
      subject: result.shop.subject,
      status: result.shop.status,
      providerId: result.shop.providerId,
      error: result.shop.error,
    });
    await writeAudit({
      staff,
      action: result.shop.status === "sent" ? "shop_copy_sent" : "shop_copy_failed",
      entityType: "order",
      entityId: order.id,
      storeId: order.storeId,
      metadata: { supplier_id: order.supplierId, kind: "shop_order_copy", shop_copy_status: result.shop.status },
    });
  }

  return {
    supplierStatus: result.supplier.status === "sent" ? "sent" : result.supplier.attempted ? "failed" : "skipped",
    shopStatus: result.shop.status,
    error: result.supplier.error || result.shop.error,
  };
}
