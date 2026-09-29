import "server-only";
import { Resend } from "resend";
import { formatUkDate, formatUkDateTime } from "@/lib/format";
import { orderSubject } from "@/lib/order-rules";
import { writeAudit } from "./audit";
import { db } from "./db";
import { isMissingRelation, logServerError } from "./errors";
import type { OrderDetail } from "./queries";
import type { Staff } from "./session";

export type EmailResult = {
  status: "sent" | "failed";
  shopCopied: boolean;
  error?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

export function orderEmailHtml(order: OrderDetail) {
  const rows = order.lines.map((line) => `<tr>
    <td>${escapeHtml(line.itemCode || "")}</td>
    <td>${escapeHtml(line.ean || "")}</td>
    <td>${escapeHtml(line.supplierCode || "")}</td>
    <td>${escapeHtml(line.name)}</td>
    <td style="text-align:right;font-weight:700">${line.quantity}</td>
  </tr>`).join("");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1c2420">
    <h1 style="font-size:22px">Mieszko order</h1>
    <p><b>Shop:</b> ${escapeHtml(order.storeName)}${order.storeCode ? ` — ${escapeHtml(order.storeCode)}` : ""}<br>
    <b>Supplier:</b> ${escapeHtml(order.supplierName)}<br>
    <b>Delivery date:</b> ${escapeHtml(formatUkDate(order.deliveryDate))}<br>
    <b>Order created:</b> ${escapeHtml(formatUkDateTime(order.submittedAt || order.createdAt))}</p>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
      <thead><tr>
        <th align="left">Item code</th><th align="left">EAN</th><th align="left">Supplier code</th><th align="left">Product name</th><th align="right">Qty</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><b>Total products:</b> ${order.products}<br><b>Total qty:</b> ${order.totalQty}</p>
  </div>`;
}

export async function deliverOrderEmail(order: OrderDetail, staff: Staff, auditAction?: string): Promise<EmailResult> {
  const supplierEmail = order.supplierEmail;
  const shopEmail = order.storeEmail;
  const subject = orderSubject(order.storeName, order.supplierName, formatUkDate(order.deliveryDate));
  const cc = [...new Set([...(shopEmail ? [shopEmail] : []), ...order.supplierCc])].filter((email) => email && email !== supplierEmail);

  let status: "sent" | "failed" = "failed";
  let providerId: string | null = null;
  let errorMessage: string | null = null;

  if (!supplierEmail) errorMessage = "Supplier order email is not configured.";
  else if (!process.env.RESEND_API_KEY || !process.env.ORDER_FROM_EMAIL) errorMessage = "Email is not configured.";
  else {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sent = await resend.emails.send({
      from: process.env.ORDER_FROM_EMAIL,
      to: [supplierEmail],
      cc: cc.length ? cc : undefined,
      subject,
      html: orderEmailHtml(order),
    });
    status = sent.error ? "failed" : "sent";
    providerId = sent.data?.id ?? null;
    errorMessage = sent.error?.message ?? null;
    if (sent.error) logServerError("order email", sent.error.message);
  }

  const logged = await db().from("order_email_log").insert({
    order_id: order.id,
    supplier_id: order.supplierId,
    order_date: order.orderDate,
    kind: "store_order",
    recipient: supplierEmail,
    cc,
    subject,
    status,
    provider_message_id: providerId,
    error_message: errorMessage,
    sent_by: staff.userId,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });
  if (logged.error && !isMissingRelation(logged.error)) logServerError("email log", logged.error.message);

  await db().from("orders").update({ email_status: status }).eq("id", order.id);
  await writeAudit({
    staff,
    action: status === "sent" ? (auditAction || "order_sent") : "order_email_failed",
    entityType: "order",
    entityId: order.id,
    storeId: order.storeId,
    metadata: { supplier_id: order.supplierId, shop_copied: Boolean(shopEmail) && status === "sent" },
  });

  return { status, shopCopied: status === "sent" && Boolean(shopEmail), error: errorMessage || undefined };
}
