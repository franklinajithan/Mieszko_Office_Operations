import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const COOKIE = "mieszko_staff_session";
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const hash = (value:string) => createHash("sha256").update(value).digest("hex");

export async function createStaffSession(profileId:string) {
  const token = crypto.randomUUID()+crypto.randomUUID();
  const expires = new Date(Date.now()+12*60*60*1000);
  const { error } = await admin().from("staff_pin_sessions").insert({profile_id:profileId,token_hash:hash(token),expires_at:expires.toISOString()});
  if(error) throw error;
  const jar=await cookies();
  jar.set(COOKIE,token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",expires});
}
export async function getStaff() {
  const jar=await cookies(); const token=jar.get(COOKIE)?.value; if(!token)return null;
  const {data}=await admin().from("staff_pin_sessions").select("profile_id,expires_at,profiles!inner(user_id,full_name,role,store_id,active)").eq("token_hash",hash(token)).gt("expires_at",new Date().toISOString()).maybeSingle();
  const p:any=data?.profiles;
  return p?.active?p:null;
}
export async function clearStaffSession() {
  const jar=await cookies(); const token=jar.get(COOKIE)?.value;
  if(token) await admin().from("staff_pin_sessions").delete().eq("token_hash",hash(token));
  jar.delete(COOKIE);
}
