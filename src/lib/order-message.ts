import { formatUkDate } from "./format";
import { orderSubject, shopCopySubject, summarize } from "./order-rules";

export type EmailOrderLine = {
  itemCode: string | null;
  ean: string | null;
  supplierCode: string | null;
  name: string;
  polishName?: string | null;
  quantity: number;
};

export type EmailOrder = {
  id: string;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  storeEmail: string | null;
  supplierName: string;
  supplierEmail: string | null;
  supplierCc: string[];
  orderDate: string;
  deliveryDate: string | null;
  lines: EmailOrderLine[];
};

export function orderedLines(lines: EmailOrderLine[]) {
  return lines.filter((line) => line.quantity > 0);
}

export function orderTotals(lines: EmailOrderLine[]) {
  return summarize(orderedLines(lines));
}

export function supplierRecipients(order: EmailOrder) {
  const blocked = new Set(
    [order.supplierEmail, order.storeEmail]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase()),
  );
  const seen = new Set<string>();
  const cc: string[] = [];
  for (const email of order.supplierCc) {
    const trimmed = email.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || blocked.has(key) || seen.has(key)) continue;
    seen.add(key);
    cc.push(trimmed);
  }
  return {
    to: order.supplierEmail?.trim() || null,
    cc,
  };
}

export function supplierEmailSubject(order: EmailOrder) {
  return orderSubject(order.storeName, order.supplierName, formatUkDate(order.deliveryDate));
}

export function shopEmailSubject(order: EmailOrder) {
  return shopCopySubject(order.storeName, order.supplierName, formatUkDate(order.deliveryDate));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

export function orderEmailHtml(order: EmailOrder, copy: boolean) {
  const lines = orderedLines(order.lines);
  const totals = summarize(lines);
  const rows = lines.map((line) => `<tr>
    <td>${escapeHtml(line.itemCode || "")}</td>
    <td>${escapeHtml(line.ean || "")}</td>
    <td>${escapeHtml(line.supplierCode || "")}</td>
    <td>${escapeHtml(line.name)}${line.polishName ? `<br><span style="color:#59635e;font-size:12px">${escapeHtml(line.polishName)}</span>` : ""}</td>
    <td style="text-align:right;font-weight:700">${line.quantity}</td>
  </tr>`).join("");
  const intro = copy ? "<p>This is the shop copy. The order PDF is attached.</p>" : "";
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1c2420">
    <h1 style="font-size:22px">${copy ? "Mieszko order copy" : "Mieszko order"}</h1>
    ${intro}
    <p><b>Shop:</b> ${escapeHtml(order.storeName)}<br>
    <b>Shop code:</b> ${escapeHtml(order.storeCode || "—")}<br>
    <b>Supplier:</b> ${escapeHtml(order.supplierName)}<br>
    <b>Delivery date:</b> ${escapeHtml(formatUkDate(order.deliveryDate))}<br>
    <b>Order date:</b> ${escapeHtml(formatUkDate(order.orderDate))}</p>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
      <thead><tr>
        <th align="left">Item Code</th><th align="left">EAN</th><th align="left">Supplier Code</th><th align="left">Product Name</th><th align="right">Qty</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><b>Total Products:</b> ${totals.products}<br><b>Total Qty:</b> ${totals.quantity}</p>
  </div>`;
}

function filenameToken(value: string) {
  const ascii = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const token = ascii.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return token || "Item";
}

export function orderPdfFilename(order: Pick<EmailOrder, "storeCode" | "storeName" | "supplierName" | "deliveryDate">) {
  const code = filenameToken(order.storeCode || order.storeName || "Shop");
  const supplier = filenameToken(order.supplierName || "Supplier");
  const formatted = formatUkDate(order.deliveryDate);
  const date = formatted === "—" ? "date" : formatted.replaceAll("/", "-");
  return `Mieszko-Order-${code}-${supplier}-${date}.pdf`;
}
