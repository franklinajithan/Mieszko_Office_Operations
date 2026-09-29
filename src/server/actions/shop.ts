"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isWholeQuantity, sendBlockReason } from "@/lib/order-rules";
import { writeAudit } from "../audit";
import { db, updateFlexible } from "../db";
import { AppError } from "../errors";
import { deliverOrderEmail } from "../order-email";
import { getOrCreateDraft, getOrder, getProduct, getSupplier, listSupplierProducts, supplierAllowedForStore } from "../queries";
import { requireStore } from "../session";

export async function startOrder(formData: FormData) {
  const staff = await requireStore();
  const supplierId = String(formData.get("supplier_id") || "");
  const deliveryDate = String(formData.get("delivery_date") || "");
  if (!supplierId) redirect("/shop/new?error=supplier");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) redirect("/shop/new?error=date");
  const supplier = await getSupplier(supplierId);
  if (!supplier || !supplier.active) redirect("/shop/new?error=supplier");
  const allowed = await supplierAllowedForStore(staff.storeId, supplierId);
  if (!allowed) redirect("/shop/new?error=supplier");
  const draft = await getOrCreateDraft({
    storeId: staff.storeId,
    supplierId,
    userId: staff.userId,
    deliveryDate,
  });
  if (!draft) redirect("/shop/new?error=save");
  redirect(`/shop/order/${draft.id}`);
}

export async function saveOrderLine(orderId: string, productId: string, quantity: number) {
  const staff = await requireStore();
  if (!isWholeQuantity(quantity)) return { error: "Enter a whole number." };

  const order = await getOrder(orderId);
  if (!order || order.storeId !== staff.storeId) return { error: "This order could not be found." };
  if (order.status !== "draft") return { error: "This order has already been sent." };
  if (!order.deliveryDate) return { error: "Please select a delivery date." };

  const product = await getProduct(productId);
  if (!product || !product.active || product.supplierId !== order.supplierId) {
    return { error: "That product is not available for this supplier." };
  }

  if (quantity === 0) {
    const { error } = await db().from("order_items").delete().eq("order_id", orderId).eq("product_id", productId);
    if (error) return { error: "Unable to update the order. Please try again." };
    return { ok: true as const };
  }

  const payload = {
    quantity,
    cases: quantity,
    case_size: 1,
    case_quantity: quantity,
    case_size_snapshot: 1,
    total_units: quantity,
    item_code_snapshot: product.itemCode,
    ean_snapshot: product.ean,
    supplier_code_snapshot: product.supplierCode,
    product_name_snapshot: product.name,
  };
  const existing = await db().from("order_items").select("id").eq("order_id", orderId).eq("product_id", productId).maybeSingle();
  try {
    if (existing.data?.id) {
      await updateFlexible("order_items", { id: String(existing.data.id) }, payload);
    } else {
      const inserted = await db().from("order_items").insert({ order_id: orderId, product_id: productId, ...payload }).select("id");
      if (inserted.error) {
        const retry = await db().from("order_items").insert({ order_id: orderId, product_id: productId, cases: quantity, case_size: 1, quantity });
        if (retry.error) {
          const casesOnly = await db().from("order_items").insert({ order_id: orderId, product_id: productId, cases: quantity, case_size: 1 });
          if (casesOnly.error) return { error: "Unable to update the order. Please try again." };
        }
      }
    }
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    return { error: "Unable to update the order. Please try again." };
  }
  return { ok: true as const };
}

async function markSent(orderId: string, actorId: string) {
  const stamped = new Date().toISOString();
  const first = await db()
    .from("orders")
    .update({ status: "submitted", submitted_at: stamped, submitted_by: actorId, email_status: "pending", updated_at: stamped })
    .eq("id", orderId)
    .eq("status", "draft")
    .select("id");
  if (!first.error && first.data?.length) return true;
  const second = await db()
    .from("orders")
    .update({ status: "submitted", submitted_at: stamped, submitted_by: actorId })
    .eq("id", orderId)
    .eq("status", "draft")
    .select("id");
  if (second.error || !second.data?.length) return false;
  return true;
}

export async function submitOrder(orderId: string) {
  const staff = await requireStore();
  const current = await getOrder(orderId);
  if (!current || current.storeId !== staff.storeId) redirect("/shop");
  const supplier = await getSupplier(current.supplierId);
  if (!supplier?.active) redirect(`/shop/order/${orderId}/review?error=supplier`);
  const activeProducts = await listSupplierProducts(current.supplierId);
  const activeIds = new Set(activeProducts.map((product) => product.id));
  const inactiveIds = current.lines.filter((line) => !activeIds.has(line.productId)).map((line) => line.productId);
  if (inactiveIds.length) {
    await db().from("order_items").delete().eq("order_id", orderId).in("product_id", inactiveIds);
  }
  const order = inactiveIds.length ? await getOrder(orderId) : current;
  if (!order) redirect("/shop");
  const block = sendBlockReason({ status: order.status, deliveryDate: order.deliveryDate, lines: order.lines });
  if (block) {
    const code = !order.deliveryDate ? "date" : order.status === "submitted" ? "already" : order.lines.length ? "submit" : "empty";
    redirect(`/shop/order/${orderId}/review?error=${code}`);
  }

  const saved = await markSent(orderId, staff.userId);
  if (!saved) redirect(`/shop/orders/${orderId}?error=already`);

  const fresh = await getOrder(orderId);
  if (!fresh) redirect("/shop");
  const email = await deliverOrderEmail(fresh, staff);
  revalidatePath("/shop");
  revalidatePath("/office");
  if (email.supplierStatus === "failed") redirect(`/shop/orders/${orderId}?email=failed`);
  if (email.shopStatus === "missing") redirect(`/shop/orders/${orderId}?sent=1&copy=missing`);
  if (email.shopStatus === "failed") redirect(`/shop/orders/${orderId}?sent=1&copy=failed`);
  redirect(`/shop/orders/${orderId}?sent=1`);
}
