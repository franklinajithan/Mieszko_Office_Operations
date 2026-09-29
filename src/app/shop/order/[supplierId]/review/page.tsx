import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/controls";
import { Banner } from "@/components/ui";
import { formatUkDate, storeLabel } from "@/lib/format";
import { sendBlockReason } from "@/lib/order-rules";
import { submitOrder } from "@/server/actions/shop";
import { getOrder } from "@/server/queries";
import { requireStore } from "@/server/session";

export default async function ReviewOrder({
  params,
  searchParams,
}: {
  params: Promise<{ supplierId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStore();
  const { supplierId: orderId } = await params;
  const query = await searchParams;
  const order = await getOrder(orderId);
  if (!order || order.storeId !== staff.storeId) notFound();
  if (order.status !== "draft") redirect(`/shop/orders/${order.id}`);
  const block = sendBlockReason({ status: order.status, deliveryDate: order.deliveryDate, lines: order.lines });
  return (
    <>
      <h1>Review order</h1>
      <Banner error={query.error} />
      <p className="muted">
        Shop: {storeLabel(order.storeName, order.storeCode)}<br />
        Supplier: {order.supplierName}<br />
        Delivery date: {formatUkDate(order.deliveryDate)}
      </p>
      {order.lines.length === 0 ? (
        <div className="emptyState"><h2>Nothing to send</h2><p>Please enter at least one product quantity.</p></div>
      ) : (
        <div className="tableWrap">
          <table className="data">
            <thead><tr><th>Item code</th><th>EAN</th><th>Supplier code</th><th>Product name</th><th>Qty</th></tr></thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.productId}>
                  <td data-label="Item code">{line.itemCode || "—"}</td>
                  <td data-label="EAN">{line.ean || "—"}</td>
                  <td data-label="Supplier code">{line.supplierCode || "—"}</td>
                  <td data-label="Product name">{line.name}</td>
                  <td data-label="Qty">{line.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="summaryGrid">
        <div className="stat"><span>Products ordered</span><strong>{order.products}</strong></div>
        <div className="stat"><span>Total qty</span><strong>{order.totalQty}</strong></div>
      </div>
      <div className="actions">
        <Link className="button secondary" href={`/shop/order/${order.id}`}>Back to edit</Link>
        <form action={submitOrder.bind(null, order.id)}>
          <SubmitButton idle="Send order" pending="Sending..." disabled={Boolean(block)} />
        </form>
      </div>
      {block && <p className="muted">{block}</p>}
    </>
  );
}
