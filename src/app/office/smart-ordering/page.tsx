import type { Metadata } from "next";
import SmartOrderingWorkspace from "@/components/smart-ordering-workspace";
export const metadata: Metadata = { title: "Smart Supplier Ordering" };
export default function SmartOrderingPage() {
  return <SmartOrderingWorkspace />;
}
