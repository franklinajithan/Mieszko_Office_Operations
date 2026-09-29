import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  let pin: unknown;
  try { ({ pin } = await req.json()); } catch {
    return NextResponse.json({ error: "Enter a 6-digit PIN" }, { status: 400 });
  }
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "Enter a 6-digit PIN" }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Staff sign-in setup is being completed. Please contact Head Office." }, { status: 503 });
  }
  const admin = createAdminClient(url, key, { auth: { persistSession: false } });

  // One-time first-run bootstrap. It is disabled forever as soon as a profile exists.
  const { count: profileCount } = await admin.from("profiles").select("user_id", { count: "exact", head: true });
  if ((profileCount ?? 0) === 0 && pin === "123456") {
    const email = "head-office-" + crypto.randomUUID() + "@staff.mieszko.internal";
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: "Head Office" }
    });
    if (createError || !created.user) {
      return NextResponse.json({ error: "Unable to activate Head Office account" }, { status: 500 });
    }
    const { error: profileError } = await admin.from("profiles").insert({
      user_id: created.user.id,
      full_name: "Head Office",
      role: "admin",
      active: true,
      login_email: email,
      pin_enabled: true
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: "Unable to activate Head Office profile" }, { status: 500 });
    }
    const { error: pinError } = await admin.rpc("set_staff_pin", { p_user_id: created.user.id, p_pin: pin });
    if (pinError) {
      await admin.from("profiles").delete().eq("user_id", created.user.id);
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: "Unable to activate Head Office PIN" }, { status: 500 });
    }
  }

  const { data, error } = await admin.rpc("verify_staff_pin", { p_pin: pin });
  if (error || !data?.length) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }
  const staff = data[0];
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: staff.login_email });
  if (linkError || !link?.properties?.hashed_token) {
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
  // Exchange on the server so SSR pages receive session cookies immediately.
  // Never return login links or authentication tokens to the UI.
  const client = await createClient();
  const { error: sessionError } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (sessionError) return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  return NextResponse.json({ actionLink: "/" }, { headers: { "Cache-Control": "no-store" } });
}
