import { NextResponse } from "next/server";
import { clearStaffSession } from "@/server/session";

export async function GET(request: Request) {
  await clearStaffSession();
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason") === "disabled"
    ? "disabled"
    : url.searchParams.get("reason") === "store"
      ? "nostore"
      : "session";
  return NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));
}
