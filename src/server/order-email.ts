import "server-only";
import { Resend } from "resend";
import { formatUkDate, formatUkDateTime } from "@/lib/format";
import { orderSubject } from "@/lib/order-rules";
import { writeAudit } from "./audit";
import { db } from "./db";
import { isMissingRelation, logServerError } from "./errors";
import type { OrderDetail } from "./queries";
import type { Staff } from "./session";

export type EmailResult = { status: "sent" | "failed"; shopCopied: boolean; error?: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}
function escapePdf(value: string) { return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "?"); }
function pdfText(x:number,y:number,size:number,text:string,bold=false){ return `BT /${bold?"F2":"F1"} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET\n`; }

export function orderPdf(order: OrderDetail): Buffer {
  const lines:string[]=[];
  lines.push(pdfText(36,806,17,"Mieszko Office Operations",true));
  lines.push(pdfText(36,782,11,`Shop: ${order.storeName}${order.storeCode ? " - "+order.storeCode : ""}`,true));
  lines.push(pdfText(36,765,10,`Supplier: ${order.supplierName}`));
  lines.push(pdfText(36,749,10,`Delivery date: ${formatUkDate(order.deliveryDate)}`));
  lines.push(pdfText(36,733,10,`Order created: ${formatUkDateTime(order.submittedAt || order.createdAt)}`));
  lines.push("0.85 G 36 718 523 1 re f 0 G\n");
  lines.push(pdfText(38,701,8,"ITEM CODE",true)); lines.push(pdfText(112,701,8,"EAN",true)); lines.push(pdfText(205,701,8,"SUPPLIER CODE",true)); lines.push(pdfText(300,701,8,"PRODUCT",true)); lines.push(pdfText(525,701,8,"QTY",true));
  let y=684;
  for(const item of order.lines){
    if(y<72) break;
    lines.push(pdfText(38,y,8,item.itemCode||"-")); lines.push(pdfText(112,y,8,item.ean||"-")); lines.push(pdfText(205,y,8,item.supplierCode||"-"));
    lines.push(pdfText(300,y,8,item.name.slice(0,42))); lines.push(pdfText(527,y,9,String(item.quantity),true));
    lines.push("0.92 G 36 "+(y-7)+" 523 0.5 re f 0 G\n"); y-=20;
  }
  lines.push(pdfText(36,45,9,`Total products: ${order.products}     Total qty: ${order.totalQty}`,true));
  const stream=lines.join("");
  const objs=[
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];
  let pdf="%PDF-1.4\n", offsets=[0];
  objs.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf); pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  pdf+=`trailer << /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export function orderEmailHtml(order: OrderDetail) {
  const rows = order.lines.map((line) => `<tr><td>${escapeHtml(line.itemCode || "")}</td><td>${escapeHtml(line.ean || "")}</td><td>${escapeHtml(line.supplierCode || "")}</td><td>${escapeHtml(line.name)}</td><td style="text-align:right;font-weight:700">${line.quantity}</td></tr>`).join("");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1c2420"><h1 style="font-size:22px">Mieszko order</h1><p><b>Shop:</b> ${escapeHtml(order.storeName)}${order.storeCode ? ` — ${escapeHtml(order.storeCode)}` : ""}<br><b>Supplier:</b> ${escapeHtml(order.supplierName)}<br><b>Delivery date:</b> ${escapeHtml(formatUkDate(order.deliveryDate))}<br><b>Order created:</b> ${escapeHtml(formatUkDateTime(order.submittedAt || order.createdAt))}</p><table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th align="left">Item code</th><th align="left">EAN</th><th align="left">Supplier code</th><th align="left">Product name</th><th align="right">Qty</th></tr></thead><tbody>${rows}</tbody></table><p><b>Total products:</b> ${order.products}<br><b>Total qty:</b> ${order.totalQty}</p></div>`;
}

export async function deliverOrderEmail(order: OrderDetail, staff: Staff, auditAction?: string): Promise<EmailResult> {
  const supplierEmail=order.supplierEmail, shopEmail=order.storeEmail;
  const subject=orderSubject(order.storeName,order.supplierName,formatUkDate(order.deliveryDate));
  let status:"sent"|"failed"="failed", providerId:string|null=null, errorMessage:string|null=null, shopCopied=false;
  if(!supplierEmail) errorMessage="Supplier order email is not configured.";
  else if(!process.env.RESEND_API_KEY || !process.env.ORDER_FROM_EMAIL) errorMessage="Email is not configured.";
  else {
    const resend=new Resend(process.env.RESEND_API_KEY);
    const supplier=await resend.emails.send({from:process.env.ORDER_FROM_EMAIL,to:[supplierEmail],cc:order.supplierCc.length?order.supplierCc:undefined,subject,html:orderEmailHtml(order)});
    status=supplier.error?"failed":"sent"; providerId=supplier.data?.id??null; errorMessage=supplier.error?.message??null;
    if(supplier.error) logServerError("supplier order email",supplier.error.message);
    if(status==="sent" && shopEmail){
      const pdf=orderPdf(order);
      const shop=await resend.emails.send({from:process.env.ORDER_FROM_EMAIL,to:[shopEmail],subject:`Copy: ${subject}`,html:orderEmailHtml(order),attachments:[{filename:`Mieszko-Order-${order.storeCode||order.storeName}-${order.deliveryDate}.pdf`,content:pdf}]});
      shopCopied=!shop.error;
      if(shop.error) logServerError("shop order copy",shop.error.message);
    }
  }
  const cc=shopEmail?[shopEmail]:[];
  const logged=await db().from("order_email_log").insert({order_id:order.id,supplier_id:order.supplierId,order_date:order.orderDate,kind:"store_order",recipient:supplierEmail,cc,subject,status,provider_message_id:providerId,error_message:errorMessage,sent_by:staff.userId,sent_at:status==="sent"?new Date().toISOString():null});
  if(logged.error&&!isMissingRelation(logged.error)) logServerError("email log",logged.error.message);
  await db().from("orders").update({email_status:status}).eq("id",order.id);
  await writeAudit({staff,action:status==="sent"?(auditAction||"order_sent"):"order_email_failed",entityType:"order",entityId:order.id,storeId:order.storeId,metadata:{supplier_id:order.supplierId,shop_copied:shopCopied,shop_pdf:shopCopied}});
  return {status,shopCopied,error:errorMessage||undefined};
}
