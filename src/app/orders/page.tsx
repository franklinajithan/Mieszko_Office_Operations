import { redirect } from "next/navigation";
import { requireStaff } from "@/server/session";

export default async function OrdersRedirect() {
  const staff = await requireStaff();
  redirect(staff.role === "store" ? "/shop/history" : "/office/orders");
}
