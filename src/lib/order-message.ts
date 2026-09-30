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
    cols.itemCode && { key:"item", label:"Item Code" }, cols.ean && { key:"ean", label:"EAN" },
    cols.supplierCode && { key:"supplier", label:"Supplier Code" }, cols.productName && { key:"product", label:"Product" },
    cols.quantity && { key:"qty", label:"Qty" },
  ].filter(Boolean) as {key:string;label:string}[];
  const cell=(line:EmailOrderLine,key:string)=>key==="item"?escapeHtml(line.itemCode||""):key==="ean"?escapeHtml(line.ean||""):key==="supplier"?escapeHtml(line.supplierCode||""):key==="qty"?String(line.quantity):`${escapeHtml(line.name)}${cols.polishName&&line.polishName?`<div style="color:#707973;font-size:12px;margin-top:3px">${escapeHtml(line.polishName)}</div>`:""}`;
  const rows=lines.map(line=>`<tr>${visible.map(col=>`<td style="padding:13px 10px;border-bottom:1px solid #e7e9e7;${col.key==="qty"?"text-align:right;font-weight:700":""}">${cell(line,col.key)}</td>`).join("")}</tr>`).join("");
  const address=[order.storeAddressLine1,order.storeAddressLine2,order.storeCity,order.storePostcode].filter(Boolean).map(v=>escapeHtml(String(v))).join("<br>");
  const ref=`PO-${escapeHtml(order.storeCode||"SHOP")}-${escapeHtml(order.id.slice(0,8).toUpperCase())}`;
  const logo="https://mieszko-office-operations.vercel.app/api/assets/mieszko-logo";
  return `<div style="margin:0;background:#f5f5f3;padding:18px 8px;font-family:Arial,Helvetica,sans-serif;color:#202522">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #e2e4e2;border-radius:12px">
    <tr><td style="padding:22px 24px;text-align:center;border-bottom:4px solid #b51f29">
      <img src="${logo}" alt="Polski Supermarket Mieszko" width="150" style="display:block;width:150px;max-width:45%;height:auto;margin:0 auto 10px">
      <div style="font-size:21px;font-weight:800;letter-spacing:.3px;color:#1c211e">POLSKI SUPERMARKET MIESZKO</div>
      <div style="font-size:12px;letter-spacing:2px;color:#777f7a;margin-top:5px">PURCHASE ORDER</div>
    </td></tr>
    <tr><td style="padding:24px">
      ${copy?'<div style="background:#f6f1ed;border-left:4px solid #b51f29;padding:10px 12px;margin-bottom:20px;font-size:13px">Shop copy — PDF purchase order attached.</div>':""}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px">
        <tr><td style="padding:0 0 18px"><div style="font-size:11px;color:#7a827d;text-transform:uppercase;font-weight:700;letter-spacing:1px">Deliver to</div><div style="font-size:18px;font-weight:800;margin-top:5px">${escapeHtml(order.storeName)}</div><div style="font-size:14px">Mieszko Store ${escapeHtml(order.storeCode||"—")}</div>${address?`<div style="font-size:14px;line-height:1.5;color:#555f59;margin-top:6px">${address}</div>`:""}${order.storePhone?`<div style="font-size:14px;color:#555f59;margin-top:4px">${escapeHtml(order.storePhone)}</div>`:""}</td></tr>
        <tr><td style="background:#f6f7f6;border-radius:8px;padding:14px 16px"><div style="font-size:11px;color:#7a827d;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:7px">Order details</div><table role="presentation" cellspacing="0" cellpadding="2" style="font-size:14px"><tr><td style="padding-right:16px;color:#69716c">Reference</td><td><b>${ref}</b></td></tr><tr><td style="padding-right:16px;color:#69716c">Supplier</td><td><b>${escapeHtml(order.supplierName)}</b></td></tr><tr><td style="padding-right:16px;color:#69716c">Order date</td><td>${escapeHtml(formatUkDate(order.orderDate))}</td></tr><tr><td style="padding-right:16px;color:#69716c">Delivery date</td><td><b>${escapeHtml(formatUkDate(order.deliveryDate))}</b></td></tr></table></td></tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px"><thead><tr style="background:#202722;color:#fff">${visible.map(col=>`<th style="padding:11px 10px;text-align:${col.key==="qty"?"right":"left"};font-size:11px;text-transform:uppercase;letter-spacing:.5px">${col.label}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
      <div style="padding:16px 0 4px;text-align:right;font-size:14px"><b>${totals.products}</b> products &nbsp;•&nbsp; <b>Total quantity: ${totals.quantity}</b></div>
    </td></tr>
    <tr><td style="background:#202722;color:#dfe3e0;padding:20px 24px;text-align:center;font-size:12px;line-height:1.6"><b style="color:#fff;font-size:13px">POLSKI SUPERMARKET MIESZKO</b><br>Mieszko Office Operations<br>This purchase order was generated automatically. Please quote <b style="color:#fff">${ref}</b> when contacting us.</td></tr>
  </table></td></tr></table></div>`;
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
