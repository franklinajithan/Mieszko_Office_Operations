export type EmailLogStatus = {
  kind: string | null;
  status: string | null;
  error?: string | null;
};

export function supplierChannelLabel(emailStatus: string | null | undefined, logs: EmailLogStatus[]) {
  const latest = logs.find((row) => row.kind === "supplier_order");
  const status = latest?.status || emailStatus;
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  return "Pending";
}

export function shopCopyLabel(storeEmail: string | null | undefined, logs: EmailLogStatus[]) {
  const latest = logs.find((row) => row.kind === "shop_order_copy");
  if (latest?.status === "sent") return "Sent";
  if (latest?.status === "missing" || (latest && /not configured/i.test(latest.error || ""))) return "Shop email not configured";
  if (latest?.status === "failed") return "Failed";
  if (!storeEmail) return "Shop email not configured";
  return "Pending";
}

export function canResendSupplier(emailStatus: string | null | undefined, logs: EmailLogStatus[]) {
  return supplierChannelLabel(emailStatus, logs) !== "Sent";
}

export function canResendShopCopy(emailStatus: string | null | undefined, storeEmail: string | null | undefined, logs: EmailLogStatus[]) {
  return supplierChannelLabel(emailStatus, logs) === "Sent" && shopCopyLabel(storeEmail, logs) !== "Sent";
}
