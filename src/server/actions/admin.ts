"use server";

import { redirect } from "next/navigation";
import { normalizeRole } from "@/lib/access";
import { parseEmails } from "@/lib/emails";
import { isSixDigitPin } from "@/lib/pin";
import { writeAudit } from "../audit";
import { db, insertFlexible, updateFlexible } from "../db";
import { AppError, logServerError, missingColumnName, rethrowRedirect } from "../errors";
import { listUsers } from "../queries";
import { clearStaffSession, requireAdmin, revokeSessions } from "../session";

function go(path: string, key: "error" | "notice", code: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}${key}=${encodeURIComponent(code)}`);
}

async function pinOwner(pin: string) {
  const { data, error } = await db().rpc("verify_staff_pin", { p_pin: pin });
  if (error) {
    logServerError("pin lookup", error.message);
    return "error" as const;
  }
  const matches = Array.isArray(data) ? data : [];
  if (matches.length > 1) return "duplicate" as const;
  return matches[0]?.user_id ? String(matches[0].user_id) : null;
}

export async function saveStore(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const codeRaw = String(formData.get("code") || "").trim();
  const active = formData.get("active") === "on";
  if (name.length < 2) go("/admin/stores", "error", "name");
  if (codeRaw && !/^\d{1,8}$/.test(codeRaw)) go("/admin/stores", "error", "code");
  const code = codeRaw || null;
  if (code) {
    const existing = await db().from("stores").select("id").eq("code", code).maybeSingle();
    if (existing.data?.id && String(existing.data.id) !== id) go(id ? `/admin/stores?edit=${id}` : "/admin/stores", "error", "code-used");
  }
  const emailRaw = String(formData.get("email") || "").trim();
  const parsedEmail = emailRaw ? parseEmails(emailRaw) : { emails: [] as string[] };
  if (parsedEmail.error || parsedEmail.emails.length > 1) go(id ? `/admin/stores?edit=${id}` : "/admin/stores", "error", "email");
  const email = parsedEmail.emails[0] || null;
  const payload = { name, code, email, active, updated_at: new Date().toISOString() };
  try {
    if (id) await updateFlexible("stores", { id }, payload);
    else await insertFlexible("stores", payload);
  } catch (error) {
    if (error instanceof AppError) go("/admin/stores", "error", "save");
    go("/admin/stores", "error", "save");
  }
  await writeAudit({
    staff,
    action: id ? "store_updated" : "store_created",
    entityType: "store",
    entityId: id || name,
    metadata: { name, active, has_code: Boolean(code) },
  });
  go("/admin/stores", "notice", "saved");
}

export async function setStoreActive(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  if (!id) go("/admin/stores", "error", "save");
  try {
    await updateFlexible("stores", { id }, { active, updated_at: new Date().toISOString() });
  } catch {
    go("/admin/stores", "error", "save");
  }
  await writeAudit({ staff, action: active ? "store_activated" : "store_deactivated", entityType: "store", entityId: id });
  go("/admin/stores", "notice", "saved");
}

async function insertProfile(payload: Record<string, unknown>) {
  const current = { ...payload };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await db().from("profiles").insert(current).select("user_id").maybeSingle();
    if (!error) return String(data?.user_id || current.user_id);
    if (/auth\.users|profiles_user_id_fkey/i.test(error.message)) return "needs-auth" as const;
    const column = missingColumnName(error.message);
    if (column && column in current) {
      delete current[column];
      continue;
    }
    logServerError("create profile", error.message);
    throw new AppError("Unable to add the user. Please try again.");
  }
  throw new AppError("Unable to add the user. Please try again.");
}

export async function saveUser(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const role = normalizeRole(String(formData.get("role") || ""));
  const storeId = String(formData.get("store_id") || "") || null;
  const active = formData.get("active") === "on";
  const pin = String(formData.get("pin") || "").trim();
  if (name.length < 2) go("/admin/users", "error", "name");
  if (!role) go("/admin/users", "error", "role");
  if (role === "store" && !storeId) go("/admin/users", "error", "store");
  if (!id && !isSixDigitPin(pin)) go("/admin/users", "error", "pin");

  const users = await listUsers();
  const activeAdmins = users.filter((user) => user.role === "admin" && user.active);
  const editing = users.find((user) => user.userId === id);
  const removesLastAdmin = Boolean(editing?.role === "admin" && editing.active && activeAdmins.length === 1 && (role !== "admin" || !active));
  if (removesLastAdmin) go(`/admin/users?edit=${id}`, "error", "last-admin");

  if (!id) {
    const owner = await pinOwner(pin);
    if (owner === "error") go("/admin/users", "error", "save");
    if (owner) go("/admin/users", "error", "pin-used");
    const userId = crypto.randomUUID();
    const base = {
      user_id: userId,
      full_name: name,
      role,
      store_id: role === "store" ? storeId : null,
      active,
      pin_enabled: true,
    };
    let createdId = "";
    let authUserId = "";
    try {
      const inserted = await insertProfile(base);
      if (inserted === "needs-auth") {
        const email = `staff.${userId}@staff.mieszko.internal`;
        const authUser = await db().auth.admin.createUser({
          email,
          password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
          email_confirm: true,
          user_metadata: { full_name: name },
        });
        if (authUser.error || !authUser.data.user) {
          logServerError("auth user", authUser.error?.message || "missing user");
          go("/admin/users", "error", "save");
        }
        authUserId = authUser.data.user.id;
        const withAuth = await insertProfile({ ...base, user_id: authUserId, login_email: email });
        if (withAuth === "needs-auth") throw new AppError("Unable to add the user. Please try again.");
        createdId = withAuth;
      } else {
        createdId = inserted;
      }
      const pinSet = await db().rpc("set_staff_pin", { p_user_id: createdId, p_pin: pin });
      if (pinSet.error) {
        await db().from("profiles").delete().eq("user_id", createdId);
        if (authUserId) await db().auth.admin.deleteUser(authUserId);
        logServerError("set pin", pinSet.error.message);
        go("/admin/users", "error", "pin-save");
      }
    } catch (error) {
      rethrowRedirect(error);
      logServerError("create user", error);
      go("/admin/users", "error", "save");
    }
    await writeAudit({ staff, action: "user_created", entityType: "user", entityId: createdId, storeId: role === "store" ? storeId : null, metadata: { role, active } });
    go("/admin/users", "notice", "saved");
  }

  try {
    await updateFlexible("profiles", { user_id: id }, {
      full_name: name,
      role,
      store_id: role === "store" ? storeId : null,
      active,
      updated_at: new Date().toISOString(),
    });
  } catch {
    go(`/admin/users?edit=${id}`, "error", "save");
  }
  if (!active) await revokeSessions(id);
  await writeAudit({ staff, action: "user_updated", entityType: "user", entityId: id, storeId: role === "store" ? storeId : null, metadata: { role, active } });
  go("/admin/users", "notice", "saved");
}

export async function setUserActive(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  const users = await listUsers();
  const target = users.find((user) => user.userId === id);
  if (!target) go("/admin/users", "error", "save");
  if (!active && target.role === "admin" && users.filter((user) => user.role === "admin" && user.active).length === 1) {
    go("/admin/users", "error", "last-admin");
  }
  try {
    await updateFlexible("profiles", { user_id: id }, { active, updated_at: new Date().toISOString() });
  } catch {
    go("/admin/users", "error", "save");
  }
  if (!active) await revokeSessions(id);
  await writeAudit({ staff, action: active ? "user_activated" : "user_deactivated", entityType: "user", entityId: id });
  go("/admin/users", "notice", "saved");
}

export async function changePin(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const pin = String(formData.get("pin") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!isSixDigitPin(pin) || pin !== confirm) go(`/admin/users?edit=${id}`, "error", "pin");
  const owner = await pinOwner(pin);
  if (owner === "error") go(`/admin/users?edit=${id}`, "error", "save");
  if (owner === "duplicate" || (owner && owner !== id)) go(`/admin/users?edit=${id}`, "error", "pin-used");
  const { error } = await db().rpc("set_staff_pin", { p_user_id: id, p_pin: pin });
  if (error) {
    logServerError("change pin", error.message);
    go(`/admin/users?edit=${id}`, "error", "pin-save");
  }
  await revokeSessions(id);
  await writeAudit({ staff, action: "pin_changed", entityType: "user", entityId: id });
  if (id === staff.userId) {
    await clearStaffSession();
    redirect("/login?notice=pin");
  }
  go("/admin/users", "notice", "pin");
}

export async function revokeUserSessions(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) go("/admin/users", "error", "save");
  await revokeSessions(id);
  await writeAudit({ staff, action: "sessions_revoked", entityType: "user", entityId: id });
  if (id === staff.userId) {
    await clearStaffSession();
    redirect("/login");
  }
  go(`/admin/users?edit=${id}`, "notice", "revoked");
}

export async function saveSupplier(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const active = formData.get("active") === "on";
  const orderEmail = String(formData.get("order_email") || "").trim();
  const cc = parseEmails(String(formData.get("cc_emails") || ""));
  if (name.length < 2) go("/admin/suppliers", "error", "name");
  if (cc.error || (orderEmail && parseEmails(orderEmail).error) || parseEmails(orderEmail).emails.length > 1) {
    go(id ? `/admin/suppliers?edit=${id}` : "/admin/suppliers", "error", "email");
  }
  const payload = {
    name,
    active,
    email_enabled: Boolean(orderEmail),
    order_email: orderEmail || null,
    cc_emails: cc.emails,
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) await updateFlexible("suppliers", { id }, payload);
    else await insertFlexible("suppliers", payload);
  } catch {
    go("/admin/suppliers", "error", "save");
  }
  await writeAudit({ staff, action: id ? "supplier_updated" : "supplier_created", entityType: "supplier", entityId: id || name, metadata: { active, email_enabled: Boolean(orderEmail) } });
  go("/admin/suppliers", "notice", "saved");
}

export async function setSupplierActive(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  try {
    await updateFlexible("suppliers", { id }, { active, updated_at: new Date().toISOString() });
  } catch {
    go("/admin/suppliers", "error", "save");
  }
  await writeAudit({ staff, action: active ? "supplier_activated" : "supplier_deactivated", entityType: "supplier", entityId: id });
  go("/admin/suppliers", "notice", "saved");
}

export async function saveProduct(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const supplierId = String(formData.get("supplier_id") || "");
  const polishName = String(formData.get("polish_name") || "").trim() || null;
  const active = formData.get("active") === "on";
  if (name.length < 2) go("/admin/products", "error", "name");
  if (!supplierId) go("/admin/products", "error", "supplier");
  const itemCode = String(formData.get("item_code") || "").trim() || null;
  const ean = String(formData.get("ean") || "").trim() || null;
  const supplierCode = String(formData.get("supplier_code") || "").trim() || null;
  const payload = {
    name,
    polish_name: polishName,
    supplier_id: supplierId,
    item_code: itemCode,
    barcode: ean,
    ean,
    supplier_code: supplierCode,
    supplier_product_code: supplierCode,
    case_size: 1,
    active,
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) await updateFlexible("products", { id }, payload);
    else await insertFlexible("products", payload);
  } catch {
    go("/admin/products", "error", "save");
  }
  await writeAudit({ staff, action: id ? "product_updated" : "product_created", entityType: "product", entityId: id || name, metadata: { supplier_id: supplierId, active } });
  go("/admin/products", "notice", "saved");
}

export async function setProductActive(formData: FormData) {
  const staff = await requireAdmin();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "true";
  try {
    await updateFlexible("products", { id }, { active, updated_at: new Date().toISOString() });
  } catch {
    go("/admin/products", "error", "save");
  }
  await writeAudit({ staff, action: active ? "product_activated" : "product_deactivated", entityType: "product", entityId: id });
  go("/admin/products", "notice", "saved");
}

export async function saveAssignments(formData: FormData) {
  const staff = await requireAdmin();
  const selected = new Set(formData.getAll("active").map(String));
  const pairs = String(formData.get("pairs") || "").split(",").filter(Boolean);
  let failed = false;
  for (const pair of pairs) {
    const [storeId, supplierId] = pair.split("|");
    if (!storeId || !supplierId) continue;
    const deadline = String(formData.get(`deadline:${pair}`) || "").trim().slice(0, 5);
    if (deadline && !/^\d{2}:\d{2}$/.test(deadline)) go("/admin/assignments", "error", "deadline");
    const payload = {
      store_id: storeId,
      supplier_id: supplierId,
      active: selected.has(pair),
      order_deadline: deadline || null,
      updated_at: new Date().toISOString(),
    };
    const existing = await db().from("store_suppliers").select("id").eq("store_id", storeId).eq("supplier_id", supplierId).maybeSingle();
    try {
      if (existing.error) throw new AppError("Assignments are not available until the database migration has been applied.");
      if (existing.data?.id) await updateFlexible("store_suppliers", { id: String(existing.data.id) }, payload);
      else await insertFlexible("store_suppliers", payload);
    } catch (error) {
      logServerError("assignment", error);
      failed = true;
      break;
    }
  }
  if (failed) go("/admin/assignments", "error", "setup");
  await writeAudit({ staff, action: "assignments_updated", entityType: "store_supplier", metadata: { pairs: pairs.length } });
  go("/admin/assignments", "notice", "saved");
}

export async function saveSettings(formData: FormData) {
  const staff = await requireAdmin();
  const deadline = String(formData.get("deadline") || "").trim().slice(0, 5);
  const note = String(formData.get("note") || "").trim();
  const enforce = formData.get("enforce") === "on";
  if (deadline && !/^\d{2}:\d{2}$/.test(deadline)) go("/admin/settings", "error", "deadline");
  const { error } = await db().from("app_settings").upsert({
    key: "orders",
    value: { deadline, enforce, note },
    updated_at: new Date().toISOString(),
    updated_by: staff.userId,
  });
  if (error) {
    logServerError("settings", error.message);
    go("/admin/settings", "error", "setup");
  }
  await writeAudit({ staff, action: "settings_updated", entityType: "settings", entityId: "orders", metadata: { enforce, has_deadline: Boolean(deadline) } });
  go("/admin/settings", "notice", "saved");
}
