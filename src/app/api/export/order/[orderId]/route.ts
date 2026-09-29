import { NextResponse } from "next/server";
import { writeAudit } from "@/server/audit";
import { storeOrderWorkbook } from "@/server/excel";
import { getOrder } from "@/server/queries";
import { getStaff } from "@/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const staff = await getStaff();
  if (!staff || staff.blocked || (staff.role !== "office" && staff.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { orderId } = await params;
  const order = await getOrder(orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await writeAudit({
    staff,
    action: "order_exported",
    entityType: "order",
    entityId: order.id,
    storeId: order.storeId,
    metadata: { supplier_id: order.supplierId },
  });
  return storeOrderWorkbook(order);
}
