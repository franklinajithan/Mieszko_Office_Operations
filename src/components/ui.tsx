import Link from "next/link";
import { formatUkDate, emailStatusLabel, statusLabel } from "@/lib/format";
import type { OrderListItem } from "@/server/queries";

const NOTICES: Record<string, string> = {
  saved: "Changes saved.",
  pin: "The PIN was changed and existing sessions were signed out.",
  revoked: "Sessions for that user were signed out.",
  sent: "The supplier email was sent.",
  cancelled: "The order was cancelled.",
};

const ERRORS: Record<string, string> = {
  name: "Enter a name.",
  pin: "Enter the same 6-digit PIN in both fields.",
  "pin-used": "That PIN is already in use. Choose a different PIN.",
  "pin-save": "The PIN could not be saved. Please try again.",
  store: "Choose a store for a store user.",
  role: "Choose a role.",
  code: "Store codes use digits only. Leave the code blank if it is not known.",
  "code-used": "That store code is already used.",
  email: "Enter one valid email address.",
  save: "Unable to save changes. Please try again.",
  "last-admin": "Keep at least one active administrator.",
  setup: "This could not be saved. Apply the latest database migration, then try again.",
  deadline: "Enter a deadline as HH:MM, or leave it blank.",
  missing: "That order could not be found.",
  locked: "This order can no longer be changed.",
  cancel: "Unable to cancel the order. Please try again.",
  cancelled: "This order is already cancelled.",
  "email-off": "Supplier email is turned off. An administrator can enable it under Suppliers.",
  "email-setup": "Email sending is not set up yet.",
  "email-failed": "The supplier email could not be sent. Please try again.",
  date: "Please select a delivery date.",
  empty: "Please enter at least one product quantity.",
  supplier: "Please select a supplier.",
  already: "This order has already been sent.",
  submit: "Unable to send the order. Please try again.",
  format: "Enter a 6-digit PIN.",
  invalid: "Invalid PIN.",
  rate: "Too many attempts. Please wait a minute and try again.",
  disabled: "This account is disabled. Please contact Head Office.",
  session: "Your session is no longer valid. Please sign in again.",
  unavailable: "Unable to sign in. Please try again.",
  duplicate: "This PIN is not unique. Please contact Head Office.",
  nostore: "Your account is not assigned to a store. Please contact Head Office.",
};

export function Banner({ notice, error }: { notice?: string; error?: string }) {
  const message = notice ? NOTICES[notice] : error ? ERRORS[error] : "";
  if (!message) return null;
  return <div className={notice ? "banner ok" : "banner error"} role={notice ? "status" : "alert"}>{message}</div>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="emptyState"><h2>{title}</h2><p>{text}</p></div>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status ${status}`}>{statusLabel(status)}</span>;
}

export function OrderTable({ orders, hrefBase, mode, empty = "No orders match these filters." }: { orders: OrderListItem[]; hrefBase: string; mode: "shop" | "office"; empty?: string }) {
  if (!orders.length) return <EmptyState title="No orders" text={empty} />;
  return (
    <div className="tableWrap">
      <table className="data">
        <thead>
          <tr>
            {mode === "office" && <th>Shop</th>}
            <th>Supplier</th>
            <th>Order date</th>
            <th>Delivery date</th>
            <th>Products</th>
            <th>Qty</th>
            <th>Email</th>
            <th>Sent by</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="clickRow">
              {mode === "office" && <td data-label="Shop"><Link className="rowLink" href={`${hrefBase}/${order.id}`}>{order.storeName}</Link></td>}
              <td data-label="Supplier">{mode === "shop" ? <Link className="rowLink" href={`${hrefBase}/${order.id}`}>{order.supplierName}</Link> : order.supplierName}</td>
              <td data-label="Order date">{formatUkDate(order.orderDate)}</td>
              <td data-label="Delivery date">{formatUkDate(order.deliveryDate)}</td>
              <td data-label="Products">{order.products}</td>
              <td data-label="Qty">{order.totalQty}</td>
              <td data-label="Email">{emailStatusLabel(order.emailStatus)}</td>
              <td data-label="Sent by">{order.sentBy || (order.status === "draft" ? "—" : "Unknown")}</td>
              <td data-label="Status"><StatusBadge status={order.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageIntro({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="pageIntro">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {text && <p className="muted">{text}</p>}
    </div>
  );
}
