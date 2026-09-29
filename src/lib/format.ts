export function formatUkDate(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatUkDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function londonToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function londonTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Sent";
    case "cancelled":
      return "Cancelled";
    case "consolidated":
      return "Consolidated";
    case "sent_to_supplier":
      return "Sent to supplier";
    case "received":
      return "Received";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function emailStatusLabel(status: string | null | undefined) {
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  if (status === "pending") return "Pending";
  return "—";
}

export function roleLabel(role: string) {
  switch (role) {
    case "store":
      return "Store";
    case "office":
      return "Office";
    case "admin":
      return "Admin";
    default:
      return role;
  }
}

export function storeLabel(name: string | null | undefined, code: string | null | undefined) {
  if (name && code) return `${name} — ${code}`;
  return name || code || "Store";
}
