export type AppRole = "store" | "office" | "admin";

export type AccessStaff = {
  role: AppRole;
  storeId: string | null;
};

export function normalizeRole(value: string | null | undefined): AppRole | null {
  const role = String(value || "").toLowerCase();
  if (role === "store" || role === "office" || role === "admin") return role;
  return null;
}

export function homePath(role: AppRole) {
  return role === "store" ? "/shop" : "/office";
}

export function canAccessOrder(staff: AccessStaff, orderStoreId: string) {
  if (staff.role === "office" || staff.role === "admin") return true;
  return staff.role === "store" && staff.storeId === orderStoreId;
}

export function canAccessAdmin(role: AppRole) {
  return role === "admin";
}

export function canManageOrders(role: AppRole) {
  return role === "office" || role === "admin";
}
