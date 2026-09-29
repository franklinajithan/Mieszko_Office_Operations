import "server-only";
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homePath, normalizeRole, type AppRole } from "@/lib/access";
import { db } from "./db";
import { isMissingRelation, logServerError } from "./errors";

const COOKIE = "mieszko_staff_session";

export type Staff = {
  userId: string;
  fullName: string;
  role: AppRole;
  storeId: string | null;
  active: boolean;
  pinEnabled: boolean;
  storeName: string | null;
  storeCode: string | null;
  blocked: boolean;
};

type StoreEmbed = { name?: string | null; code?: string | null };
type ProfileEmbed = {
  user_id: string;
  full_name?: string | null;
  role?: string | null;
  store_id?: string | null;
  active?: boolean | null;
  pin_enabled?: boolean | null;
  stores?: StoreEmbed | StoreEmbed[] | null;
};

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toStaff(profile: ProfileEmbed, blocked: boolean): Staff | null {
  const role = normalizeRole(profile.role);
  if (!role) return null;
  const store = one(profile.stores);
  return {
    userId: profile.user_id,
    fullName: profile.full_name?.trim() || "Staff",
    role,
    storeId: profile.store_id ?? null,
    active: profile.active !== false,
    pinEnabled: profile.pin_enabled !== false,
    storeName: store?.name ?? null,
    storeCode: store?.code ?? null,
    blocked,
  };
}

export async function createStaffSession(userId: string) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const { error } = await db().from("staff_pin_sessions").insert({
    profile_id: userId,
    token_hash: hashToken(token),
    expires_at: null,
  });
  if (error) {
    logServerError("create session", error.message);
    throw new Error("session");
  }
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

export async function clearStaffSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      await db().from("staff_pin_sessions").delete().eq("token_hash", hashToken(token));
    } catch (error) {
      logServerError("clear session", error);
    }
  }
  jar.delete(COOKIE);
}

export async function revokeSessions(userId: string) {
  const { error } = await db().from("staff_pin_sessions").delete().eq("profile_id", userId);
  if (error) logServerError("revoke sessions", error.message);
}

async function readProfile(tokenHash: string) {
  const primary = await db()
    .from("staff_pin_sessions")
    .select("profiles!inner(user_id, full_name, role, store_id, active, pin_enabled, stores(name, code))")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!primary.error) return one(primary.data?.profiles as ProfileEmbed | ProfileEmbed[] | null);
  if (!/pin_enabled/i.test(primary.error.message)) {
    logServerError("session lookup", primary.error.message);
    return null;
  }
  const fallback = await db()
    .from("staff_pin_sessions")
    .select("profiles!inner(user_id, full_name, role, store_id, active, stores(name, code))")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (fallback.error) {
    logServerError("session lookup", fallback.error.message);
    return null;
  }
  return one(fallback.data?.profiles as ProfileEmbed | ProfileEmbed[] | null);
}

export async function getStaff(): Promise<Staff | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const profile = await readProfile(hashToken(token));
    if (!profile) return null;
    const blocked = profile.active === false || profile.pin_enabled === false;
    return toStaff(profile, blocked);
  } catch (error) {
    logServerError("session", error);
    return null;
  }
}

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect("/session/end");
  if (staff.blocked) redirect("/session/end?reason=disabled");
  return staff;
}

export async function requireStore() {
  const staff = await requireStaff();
  if (staff.role !== "store") redirect(homePath(staff.role));
  if (!staff.storeId) redirect("/session/end?reason=store");
  return staff as Staff & { storeId: string; role: "store" };
}

export async function requireOffice() {
  const staff = await requireStaff();
  if (staff.role === "store") redirect("/shop");
  return staff;
}

export async function requireAdmin() {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect(staff.role === "store" ? "/shop" : "/office");
  return staff;
}

export async function touchLastSeen(userId: string) {
  const { error } = await db().from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId);
  if (error && !/last_seen_at/i.test(error.message)) logServerError("last seen", error.message);
}

export async function loadProfile(userId: string) {
  const { data, error } = await db()
    .from("profiles")
    .select("user_id, full_name, role, store_id, active, pin_enabled, stores(name, code)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && /pin_enabled/i.test(error.message)) {
    const fallback = await db()
      .from("profiles")
      .select("user_id, full_name, role, store_id, active, stores(name, code)")
      .eq("user_id", userId)
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    return toStaff(fallback.data as ProfileEmbed, fallback.data.active === false);
  }
  if (error || !data) {
    if (error) logServerError("load profile", error.message);
    return null;
  }
  const blocked = data.active === false || data.pin_enabled === false;
  return toStaff(data as ProfileEmbed, blocked);
}

export function relationMissing(error: { message?: string; code?: string } | null) {
  return isMissingRelation(error);
}
