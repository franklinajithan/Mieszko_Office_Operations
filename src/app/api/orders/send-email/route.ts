import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {orderId}=await req.json();
  const {data:order,error}=await supabase.from("orders").select("id,order_date,status,store_id,supplier_id,stores(name),suppliers(name,order_email,cc_emails,email_subject_template,email_enabled),order_items(cases,case_size,products(name,item_code,barcode))").eq("id",orderId).single();
  if(error||!order)return NextResponse.json({error:"Order not found"},{status:404});
  const supplier:any=order.suppliers, store:any=order.stores;
  if(!supplier?.email_enabled||!supplier?.order_email)return NextResponse.json({error:"Supplier order email is not configured"},{status:400});
  const lines=(order.order_items as any[]).filter(i=>i.cases>0);
  if(!lines.length)return NextResponse.json({error:"Order has no quantities"},{status:400});
  const subject=String(supplier.email_subject_template||"Mieszko Order - {{store}} - {{date}}").replaceAll("{{store}}",store.name).replaceAll("{{date}}",order.order_date);
  const rows=lines.map(i=>`<tr><td>${i.products.item_code||""}</td><td>${i.products.name}</td><td style="text-align:center">${i.case_size}</td><td style="text-align:center;font-weight:700">${i.cases}</td><td style="text-align:center">${i.cases*i.case_size}</td></tr>`).join("");
  const html=`<h2>Mieszko - ${store.name}</h2><p>Please find our order for <b>${supplier.name}</b> dated ${order.order_date}.</p><table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse"><thead><tr><th>Item code</th><th>Product</th><th>Case size</th><th>Cases</th><th>Total units</th></tr></thead><tbody>${rows}</tbody></table><p>Thank you.</p>`;
  const resend=new Resend(process.env.RESEND_API_KEY);
  const {data,error:sendError}=await resend.emails.send({from:process.env.ORDER_FROM_EMAIL!,to:[supplier.order_email],cc:supplier.cc_emails||[],subject,html});
  await supabase.from("order_email_log").insert({order_id:order.id,recipient:supplier.order_email,cc:supplier.cc_emails||[],subject,status:sendError?"failed":"sent",provider_message_id:data?.id||null,error_message:sendError?.message||null,sent_by:user.id,sent_at:sendError?null:new Date().toISOString()});
  if(sendError)return NextResponse.json({error:sendError.message},{status:502});
  return NextResponse.json({ok:true,messageId:data?.id});
}
