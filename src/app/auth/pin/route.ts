import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const form = await req.formData();
  const pin = String(form.get("pin") || "");
  const base = new URL(req.url);
  const go = (path: string) => NextResponse.redirect(new URL(path, base), 303);
  if (!/^\d{6}$/.test(pin)) return go("/login?error=pin");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const admin = createAdminClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("verify_staff_pin", { p_pin: pin });
  if (error || !data?.length) return go("/login?error=invalid");
  const staff = data[0];

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: staff.login_email
  });
  if (linkError || !link?.properties?.hashed_token) return go("/login?error=signin");

  const target = staff.role === "store" ? "/shop" : "/head-office";
  const response = go(target);
  const incomingCookie = req.headers.get("cookie") || "";
  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return incomingCookie.split(";").map(v => v.trim()).filter(Boolean).map(v => {
          const i = v.indexOf("=");
          return { name: i < 0 ? v : v.slice(0, i), value: i < 0 ? "" : v.slice(i + 1) };
        });
      },
      setAll(items) {
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink"
  });
  if (sessionError) return go("/login?error=signin");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
