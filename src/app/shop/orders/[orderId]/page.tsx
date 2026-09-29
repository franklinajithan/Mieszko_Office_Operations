import Link from "next/link";
import { notFound } from "next/navigation";
import { Banner, StatusBadge } from "@/components/ui";
import { canAccessOrder } from "@/lib/access";
import { emailStatusLabel, formatUkDate, formatUkDateTime, storeLabel } from "@/lib/format";
import { getOrder } from "@/server/queries";
import { requireStore } from "@/server/session";

export default async function ShopOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ sent?: string; email?: string; copy?: string; error?: string }>;
}) {
  const staff = await requireStore();
  const { orderId } = await params;
  const query = await searchParams;
  const order = await getOrder(orderId);
  if (!order || !canAccessOrder(staff, order.storeId)) notFound();
  const justSent = query.sent === "1" && order.status === "submitted";
  const emailFailed = query.email === "failed";
  return (
    <article>
      {emailFailed && <h1>Order saved</h1>}
      {justSent && !emailFailed && <h1>Order sent</h1>}
      {!justSent && !emailFailed && <h1>{order.supplierName}</h1>}
      <Banner error={query.error} />
      {emailFailed && <div className="banner error" role="alert">Order saved, but the email could not be sent.</div>}
      {justSent && !emailFailed && (
        <p>{query.copy === "missing"
          ? "The supplier has received the order. Shop email is not configured, so no copy was sent."
          : query.copy === "failed"
            ? "The supplier has received the order. The shop PDF copy could not be sent."
            : "The supplier has received the order and a PDF copy has been sent to the shop email."}</p>
      )}
      <p className="muted">
        Supplier: {order.supplierName}<br />
        Shop: {storeLabel(order.storeName, order.storeCode)}<br />
        Delivery: {formatUkDate(order.deliveryDate)}<br />
        {order.submittedAt ? `Sent: ${formatUkDateTime(order.submittedAt)}` : `Created: ${formatUkDate(order.orderDate)}`}
      </p>
      <p><StatusBadge status={order.status} /> <span className="muted">Email: {emailStatusLabel(order.emailStatus)}</span></p>
      <div className="summaryGrid">
        <div className="stat"><span>Products</span><strong>{order.products}</strong></div>
        <div className="stat"><span>Total qty</span><strong>{order.totalQty}</strong></div>
      </div>
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
      <div className="actions" style={{ marginTop: 16 }}>
        {(justSent || emailFailed) && <Link className="button primary" href={`/shop/orders/${order.id}`}>View order</Link>}
        <Link className="button secondary" href="/shop/new">Create another order</Link>
        <Link className="button secondary" href="/shop">Shop home</Link>
        {order.status === "draft" && <Link className="button secondary" href={`/shop/order/${order.id}`}>Continue editing</Link>}
      </div>
    </article>
  );
}
