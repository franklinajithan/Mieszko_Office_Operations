import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const COOKIE="mieszko_staff_session";
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");

export async function createStaffSession(profileId:string){
  const token=crypto.randomUUID()+crypto.randomUUID();
  const {error}=await db().from("staff_pin_sessions").insert({profile_id:profileId,token_hash:hash(token),expires_at:null});
  if(error)throw error;
  const jar=await cookies();
  jar.set(COOKIE,token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:60*60*24*365});
}
export async function getStaff(){
  const jar=await cookies();const token=jar.get(COOKIE)?.value;if(!token)return null;
  const {data}=await db().from("staff_pin_sessions").select("profile_id,profiles!inner(user_id,full_name,role,store_id,active)").eq("token_hash",hash(token)).maybeSingle();
  const p:any=data?.profiles;return p?.active?p:null;
}
export async function clearStaffSession(){
  const jar=await cookies();const token=jar.get(COOKIE)?.value;
  if(token)await db().from("staff_pin_sessions").delete().eq("token_hash",hash(token));
  jar.delete(COOKIE);
}
