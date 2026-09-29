import { ShopShell } from "@/components/shells";
import { requireStore } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStore();
  return <ShopShell storeName={staff.storeName || "Your store"} storeCode={staff.storeCode}>{children}</ShopShell>;
}
