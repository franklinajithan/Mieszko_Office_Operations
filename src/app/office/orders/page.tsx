import { redirect } from "next/navigation";

export default async function OfficeOrdersRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  redirect(params.size ? `/office?${params}` : "/office");
}
