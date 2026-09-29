"use server";

import { redirect } from "next/navigation";
import { canResendShopCopy, canResendSupplier } from "@/lib/order-email-status";
import { writeAudit } from "../audit";
import { db } from "../db";
import { isMissingFunction, logServerError } from "../errors";
import { deliverOrderEmail } from "../order-email";
import { getOrder, listOrderEmailLogs } from "../queries";
import { requireOffice } from "../session";

export async function cancelOrder(orderId: string) {
  const staff = await requireOffice();
  const order = await getOrder(orderId);
  if (!order) redirect("/office/orders?error=missing");
  if (order.status === "cancelled") redirect(`/office/orders/${orderId}?error=cancelled`);
  if (order.status !== "draft" && order.status !== "submitted") redirect(`/office/orders/${orderId}?error=locked`);

  const rpc = await db().rpc("app_cancel_order", { p_order_id: orderId, p_actor: staff.userId });
  if (rpc.error && isMissingFunction(rpc.error)) {
    const { data, error } = await db()
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: staff.userId })
      .eq("id", orderId)
      .in("status", ["draft", "submitted"])
      .select("id");
    if (error || !data?.length) {
      const retry = await db().from("orders").update({ status: "cancelled" }).eq("id", orderId).in("status", ["draft", "submitted"]).select("id");
      if (retry.error || !retry.data?.length) {
        logServerError("cancel order", retry.error?.message || error?.message || "no row");
        redirect(`/office/orders/${orderId}?error=cancel`);
      }
    }
    await writeAudit({
      staff,
      action: "order_cancelled",
      entityType: "order",
      entityId: orderId,
      storeId: order.storeId,
    });
  } else if (rpc.error) {
    logServerError("cancel order", rpc.error.message);
    redirect(`/office/orders/${orderId}?error=cancel`);
  }

  redirect(`/office/orders/${orderId}?notice=cancelled`);
}

export async function resendSupplierEmail(orderId: string) {
  const staff = await requireOffice();
  const order = await getOrder(orderId);
  if (!order || order.status !== "submitted") redirect(`/office/orders/${orderId}?error=locked`);
  const logs = await listOrderEmailLogs(orderId);
  if (!canResendSupplier(order.emailStatus, logs)) redirect(`/office/orders/${orderId}?notice=supplier-already`);
  const email = await deliverOrderEmail(order, staff, { target: "supplier", auditAction: "order_email_resent" });
  redirect(`/office/orders/${orderId}?notice=${email.supplierStatus === "sent" ? "supplier-sent" : "supplier-failed"}`);
}

export async function resendShopCopy(orderId: string) {
  const staff = await requireOffice();
  const order = await getOrder(orderId);
  if (!order || order.status !== "submitted") redirect(`/office/orders/${orderId}?error=locked`);
  const logs = await listOrderEmailLogs(orderId);
  if (canResendSupplier(order.emailStatus, logs)) redirect(`/office/orders/${orderId}?error=supplier-first`);
  if (!canResendShopCopy(order.emailStatus, order.storeEmail, logs)) redirect(`/office/orders/${orderId}?notice=shop-already`);
  const email = await deliverOrderEmail(order, staff, { target: "shop" });
  const notice = email.shopStatus === "sent" ? "shop-sent" : email.shopStatus === "missing" ? "shop-missing" : "shop-failed";
  redirect(`/office/orders/${orderId}?notice=${notice}`);
}
