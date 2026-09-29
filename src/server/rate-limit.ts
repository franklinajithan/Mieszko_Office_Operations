import "server-only";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { pinCooldownActive } from "@/lib/pin";
import { db } from "./db";
import { isMissingRelation, logServerError } from "./errors";

function hashIp(value: string) {
  return createHash("sha256").update(`mieszko-pin:${value}`).digest("hex");
}

export async function clientKey() {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerStore.get("x-real-ip") || "unknown";
  return hashIp(ip);
}

export async function isRateLimited(ipHash: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await db()
    .from("pin_attempts")
    .select("created_at")
    .eq("ip_hash", ipHash)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isMissingRelation(error)) logServerError("pin rate limit", error.message);
    return false;
  }
  const latest = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : 0;
  const seconds = latest ? (Date.now() - latest) / 1000 : 999;
  return pinCooldownActive(data?.length ?? 0, seconds);
}

export async function recordPinFailure(ipHash: string) {
  await db().from("pin_attempts").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const { error } = await db().from("pin_attempts").insert({ ip_hash: ipHash });
  if (error && !isMissingRelation(error)) logServerError("pin attempt", error.message);
}

export async function clearPinFailures(ipHash: string) {
  const { error } = await db().from("pin_attempts").delete().eq("ip_hash", ipHash);
  if (error && !isMissingRelation(error)) logServerError("clear pin attempts", error.message);
}
