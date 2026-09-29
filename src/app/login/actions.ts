"use server";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function pinLogin(formData: FormData) {
  const pin = String(formData.get("pin") || "");
  if (!/^\d{6}$/.test(pin)) redirect("/login?error=pin");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createAdminClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("verify_staff_pin", { p_pin: pin });
  if (error || !data?.length) redirect("/login?error=invalid");
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: data[0].login_email });
  if (linkError || !link?.properties?.hashed_token) redirect("/login?error=signin");
  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (sessionError) redirect("/login?error=signin");
  redirect("/");
}
