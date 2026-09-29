"use server";

import { redirect } from "next/navigation";
import { homePath, normalizeRole } from "@/lib/access";
import { isSixDigitPin } from "@/lib/pin";
import { writeAudit } from "../audit";
import { db } from "../db";
import { logServerError } from "../errors";
import { clearPinFailures, clientKey, isRateLimited, recordPinFailure } from "../rate-limit";
import { clearStaffSession, createStaffSession, getStaff, loadProfile, touchLastSeen } from "../session";

export async function signIn(formData: FormData) {
  const pin = String(formData.get("pin") ?? "").trim();
  if (!isSixDigitPin(pin)) redirect("/login?error=format");

  const ipHash = await clientKey();
  if (await isRateLimited(ipHash)) redirect("/login?error=rate");

  const { data, error } = await db().rpc("verify_staff_pin", { p_pin: pin });
  if (error) {
    logServerError("pin verify", error.message);
    redirect("/login?error=unavailable");
  }
  const matches = Array.isArray(data) ? data : [];
  if (matches.length !== 1 || !matches[0]?.user_id) {
    await recordPinFailure(ipHash);
    redirect(matches.length > 1 ? "/login?error=duplicate" : "/login?error=invalid");
  }

  const profile = await loadProfile(String(matches[0].user_id));
  if (!profile || profile.blocked || !profile.active || !profile.pinEnabled) {
    redirect("/login?error=disabled");
  }
  const role = normalizeRole(profile.role);
  if (!role) redirect("/login?error=unavailable");
  if (role === "store" && !profile.storeId) redirect("/login?error=nostore");

  await clearPinFailures(ipHash);
  try {
    await createStaffSession(profile.userId);
  } catch (sessionError) {
    logServerError("sign in", sessionError);
    redirect("/login?error=unavailable");
  }
  await touchLastSeen(profile.userId);
  await writeAudit({ staff: profile, action: "signed_in", entityType: "session", entityId: profile.userId });
  redirect(homePath(role));
}

export async function signOut() {
  const staff = await getStaff();
  if (staff && !staff.blocked) {
    await writeAudit({ staff, action: "signed_out", entityType: "session", entityId: staff.userId });
  }
  await clearStaffSession();
  redirect("/login");
}
