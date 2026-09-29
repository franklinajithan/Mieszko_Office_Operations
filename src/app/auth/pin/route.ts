import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const pin = String(form.get("pin") || "");
  const base = new URL(req.url);
  if (!/^\d{6}$/.test(pin)) return NextResponse.redirect(new URL("/login?error=pin", base), 303);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createAdminClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("verify_staff_pin", { p_pin: pin });
  if (error || !data?.length) return NextResponse.redirect(new URL("/login?error=invalid", base), 303);
  const staff = data[0];
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: staff.login_email });
  if (linkError || !link?.properties?.hashed_token) return NextResponse.redirect(new URL("/login?error=signin", base), 303);
  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (sessionError) return NextResponse.redirect(new URL("/login?error=signin", base), 303);
  return NextResponse.redirect(new URL(staff.role === "store" ? "/shop" : "/head-office", base), 303);
}
