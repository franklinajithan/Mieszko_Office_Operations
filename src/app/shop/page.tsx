import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { storeLabel } from "@/lib/format";
import { requireStore } from "@/server/session";

export default async function ShopHome() {
  const staff = await requireStore();
  return (
    <>
      <PageIntro title={storeLabel(staff.storeName, staff.storeCode)} text="Create a supplier order for this shop." />
      <div className="actions">
        <Link className="button primary" href="/shop/new">Create supplier order</Link>
        <Link className="button secondary" href="/shop/history">Order history</Link>
      </div>
    </>
  );
}
