import { Banner, OrderTable, PageIntro } from "@/components/ui";
import { listOrders, listStoreSuppliers } from "@/server/queries";
import { requireStore } from "@/server/session";

export default async function ShopHistory({ searchParams }: { searchParams: Promise<{ date?: string; delivery?: string; supplier?: string; status?: string; error?: string }> }) {
  const staff = await requireStore();
  const query = await searchParams;
  const [orders, suppliers] = await Promise.all([
    listOrders({
      storeId: staff.storeId,
      date: query.date || undefined,
      deliveryDate: query.delivery || undefined,
      supplierId: query.supplier || undefined,
      status: query.status || undefined,
    }),
    listStoreSuppliers(staff.storeId),
  ]);
  return (
    <>
      <PageIntro title="Order history" text="Orders for this shop only." />
      <Banner error={query.error} />
      <form className="filters" method="get">
        <label className="field">Order date<input type="date" name="date" defaultValue={query.date || ""} /></label>
        <label className="field">Delivery date<input type="date" name="delivery" defaultValue={query.delivery || ""} /></label>
        <label className="field">Supplier
          <select name="supplier" defaultValue={query.supplier || ""}>
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className="field">Status
          <select name="status" defaultValue={query.status || ""}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button className="button primary" type="submit">Filter</button>
      </form>
      <OrderTable orders={orders} hrefBase="/shop/orders" mode="shop" empty="This shop has no orders yet." />
    </>
  );
}
