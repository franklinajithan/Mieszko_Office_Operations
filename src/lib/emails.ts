const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(value: string): { emails: string[]; error?: string } {
  const emails = value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = emails.find((email) => !EMAIL.test(email));
  if (invalid) return { emails: [], error: "Enter valid email addresses, separated by commas." };
  return { emails };
}

export function emailList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return parseEmails(value).emails;
  return [];
}
