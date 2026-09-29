import Link from "next/link";
import { Banner, PageIntro } from "@/components/ui";
import { storeLabel } from "@/lib/format";
import { startOrder } from "@/server/actions/shop";
import { listStoreSuppliers } from "@/server/queries";
import { requireStore } from "@/server/session";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await requireStore();
  const query = await searchParams;
  const suppliers = await listStoreSuppliers(staff.storeId);
  return (
    <>
      <p><Link href="/shop">Shop home</Link></p>
      <PageIntro title="New order" />
      <Banner error={query.error} />
      <form className="panel formGrid" action={startOrder}>
        <label className="field">Shop
          <input value={storeLabel(staff.storeName, staff.storeCode)} readOnly />
        </label>
        <label className="field">Supplier
          <select name="supplier_id" defaultValue="" required>
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className="field">Delivery date
          <input name="delivery_date" type="date" required />
        </label>
        <div className="actions wide">
          <button className="button primary" type="submit">Continue</button>
        </div>
      </form>
      {suppliers.length === 0 && <p className="muted">No active suppliers are available for this shop.</p>}
    </>
  );
}
