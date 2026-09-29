import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/controls";
import { Banner, StatusBadge } from "@/components/ui";
import { emailStatusLabel, formatUkDate, formatUkDateTime, storeLabel } from "@/lib/format";
import { resendOrderEmail } from "@/server/actions/office";
import { getOrder } from "@/server/queries";

export default async function OfficeOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  const order = await getOrder(orderId);
  if (!order) notFound();
  return (
    <article>
      <h1>{order.supplierName}</h1>
      <Banner notice={query.notice} error={query.error} />
      <p className="muted">
        Shop: {storeLabel(order.storeName, order.storeCode)}<br />
        Store code: {order.storeCode || "—"}<br />
        Supplier: {order.supplierName}<br />
        Order created: {formatUkDate(order.orderDate)}<br />
        Delivery date: {formatUkDate(order.deliveryDate)}<br />
        Sent: {formatUkDateTime(order.submittedAt)}<br />
        Email: {emailStatusLabel(order.emailStatus)}
      </p>
      <p><StatusBadge status={order.status} /></p>
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
        <a className="button secondary" href={`/api/export/order/${order.id}`}>Export Excel</a>
        {order.status === "submitted" && (
          <form action={resendOrderEmail.bind(null, order.id)}>
            <SubmitButton idle="Resend email" pending="Sending..." className="button secondary" />
          </form>
        )}
        <Link className="button secondary" href="/office">Back</Link>
      </div>
    </article>
  );
}
