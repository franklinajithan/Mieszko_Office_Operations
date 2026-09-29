import { OrderTable, PageIntro } from "@/components/ui";
import { listOrders, listStores, listSuppliers } from "@/server/queries";

export default async function OfficeHome({ searchParams }: { searchParams: Promise<{ date?: string; delivery?: string; store?: string; supplier?: string; status?: string; email?: string }> }) {
  const query = await searchParams;
  const [orders, stores, suppliers] = await Promise.all([
    listOrders({
      date: query.date || undefined,
      deliveryDate: query.delivery || undefined,
      storeId: query.store || undefined,
      supplierId: query.supplier || undefined,
      status: query.status || undefined,
      emailStatus: query.email || undefined,
    }),
    listStores(),
    listSuppliers(),
  ]);
  return (
    <>
      <PageIntro title="Orders" text="Every shop order." />
      <form className="filters" method="get">
        <label className="field">Shop
          <select name="store" defaultValue={query.store || ""}>
            <option value="">All shops</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </label>
        <label className="field">Supplier
          <select name="supplier" defaultValue={query.supplier || ""}>
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className="field">Order date<input type="date" name="date" defaultValue={query.date || ""} /></label>
        <label className="field">Delivery date<input type="date" name="delivery" defaultValue={query.delivery || ""} /></label>
        <label className="field">Status
          <select name="status" defaultValue={query.status || ""}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="field">Email
          <select name="email" defaultValue={query.email || ""}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <button className="button primary" type="submit">Filter</button>
      </form>
      <OrderTable orders={orders} hrefBase="/office/orders" mode="office" />
    </>
  );
}
