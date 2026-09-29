import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createStaffSession } from "@/lib/staff-session";

export async function POST(req:Request){
  const form=await req.formData(); const pin=String(form.get("pin")||""); const base=new URL(req.url);
  const go=(p:string)=>NextResponse.redirect(new URL(p,base),303);
  if(!/^\d{6}$/.test(pin))return go("/login?error=pin");
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const {data,error}=await db.rpc("verify_staff_pin",{p_pin:pin});
  if(error||!data?.length)return go("/login?error=invalid");
  const staff=data[0];
  await createStaffSession(staff.user_id);
  return go(staff.role==="store"?"/shop":"/head-office");
}
