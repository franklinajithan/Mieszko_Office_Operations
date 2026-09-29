import { redirect } from "next/navigation";
import { homePath } from "@/lib/access";
import { requireStaff } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const staff = await requireStaff();
  redirect(homePath(staff.role));
}
