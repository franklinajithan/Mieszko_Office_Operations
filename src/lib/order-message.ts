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
  storeAddressLine1?: string | null;
  storeAddressLine2?: string | null;
  storeCity?: string | null;
  storePostcode?: string | null;
  storePhone?: string | null;
  supplierName: string;
  supplierEmail: string | null;
  supplierCc: string[];
  emailColumns?: { itemCode: boolean; ean: boolean; supplierCode: boolean; productName: boolean; polishName: boolean; quantity: boolean };
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
  const cols = order.emailColumns || { itemCode:false, ean:false, supplierCode:true, productName:true, polishName:false, quantity:true };
  const visible = [
    cols.itemCode && { key:"item", label:"Item Code" },
    cols.ean && { key:"ean", label:"EAN" },
    cols.supplierCode && { key:"supplier", label:"Supplier Code" },
    cols.productName && { key:"product", label:"Product" },
    cols.quantity && { key:"qty", label:"Qty" },
  ].filter(Boolean) as {key:string;label:string}[];
  const cell = (line: EmailOrderLine, key:string) => key === "item" ? escapeHtml(line.itemCode || "") : key === "ean" ? escapeHtml(line.ean || "") : key === "supplier" ? escapeHtml(line.supplierCode || "") : key === "qty" ? String(line.quantity) : `${escapeHtml(line.name)}${cols.polishName && line.polishName ? `<div style="color:#66736c;font-size:12px;margin-top:3px">${escapeHtml(line.polishName)}</div>` : ""}`;
  const rows = lines.map(line => `<tr>${visible.map(col => `<td style="padding:12px 10px;border-bottom:1px solid #e5e9e6;${col.key==="qty" ? "text-align:right;font-weight:700" : ""}">${cell(line,col.key)}</td>`).join("")}</tr>`).join("");
  const address = [order.storeAddressLine1, order.storeAddressLine2, order.storeCity, order.storePostcode].filter(Boolean).map(v=>escapeHtml(String(v))).join("<br>");
  const ref = `PO-${escapeHtml(order.storeCode || "SHOP")}-${escapeHtml(order.id.slice(0,8).toUpperCase())}`;
  return `<div style="margin:0;background:#f4f6f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#17201b">
    <div style="max-width:760px;margin:auto;background:#fff;border:1px solid #e1e6e3;border-radius:14px;overflow:hidden">
      <div style="background:#17211c;color:#fff;padding:24px 28px;display:flex;align-items:center">
        <div style="display:inline-block;background:#b91f26;color:#fff;font-size:26px;font-weight:800;border-radius:10px;padding:9px 15px;margin-right:14px">M</div>
        <div style="display:inline-block;vertical-align:top"><div style="font-size:22px;font-weight:800">MIESZKO</div><div style="font-size:12px;letter-spacing:1.4px;color:#d8dfdb">PURCHASE ORDER</div></div>
      </div>
      <div style="padding:28px">
        ${copy ? '<div style="background:#f3f5f4;padding:10px 12px;border-radius:8px;margin-bottom:20px;font-size:13px">Shop copy — PDF purchase order attached.</div>' : ""}
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tr>
          <td style="vertical-align:top;width:55%"><div style="font-size:12px;color:#69746e;text-transform:uppercase;font-weight:700;margin-bottom:7px">Deliver to</div><div style="font-size:17px;font-weight:800">Mieszko — ${escapeHtml(order.storeName)}</div><div>Store ${escapeHtml(order.storeCode || "—")}</div>${address ? `<div style="margin-top:6px;color:#4f5b55">${address}</div>` : ""}${order.storePhone ? `<div style="margin-top:4px;color:#4f5b55">${escapeHtml(order.storePhone)}</div>` : ""}</td>
          <td style="vertical-align:top"><div style="font-size:12px;color:#69746e;text-transform:uppercase;font-weight:700;margin-bottom:7px">Order details</div><b>Reference:</b> ${ref}<br><b>Supplier:</b> ${escapeHtml(order.supplierName)}<br><b>Order date:</b> ${escapeHtml(formatUkDate(order.orderDate))}<br><b>Delivery date:</b> ${escapeHtml(formatUkDate(order.deliveryDate))}</td>
        </tr></table>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
          <thead><tr style="background:#f3f5f4">${visible.map(col => `<th style="padding:10px;text-align:${col.key==="qty" ? "right" : "left"};font-size:12px;text-transform:uppercase;letter-spacing:.4px">${col.label}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:20px;text-align:right"><b>${totals.products}</b> products&nbsp;&nbsp;·&nbsp;&nbsp;<b>Total quantity: ${totals.quantity}</b></div>
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e9e6;color:#66736c;font-size:12px;line-height:1.6">Kind regards,<br><b style="color:#17201b">Mieszko Office Operations</b><br>Polski Supermarket Mieszko<br><br>This purchase order was generated automatically by Mieszko Office Operations.</div>
      </div>
    </div>
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
