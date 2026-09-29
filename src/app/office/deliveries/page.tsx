import { OrderTable, PageIntro } from "@/components/ui";
import { londonToday } from "@/lib/format";
import { listOrders, listStores, listSuppliers } from "@/server/queries";

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    delivery?: string;
    store?: string;
    supplier?: string;
    status?: string;
  }>;
}) {
  const query = await searchParams;
  const targetDate = query.delivery || londonToday();
  
  const [orders, stores, suppliers] = await Promise.all([
    listOrders({
      deliveryDate: targetDate,
      storeId: query.store || undefined,
      supplierId: query.supplier || undefined,
      status: query.status || undefined,
    }),
    listStores(),
    listSuppliers(),
  ]);

  return (
    <>
      <PageIntro
        title="Deliveries"
        text="Track orders by delivery date."
      />
      <form className="filters" method="get">
        <label className="field">
          Delivery date
          <input
            type="date"
            name="delivery"
            defaultValue={targetDate}
            required
          />
        </label>
        <label className="field">
          Shop
          <select name="store" defaultValue={query.store || ""}>
            <option value="">All shops</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Supplier
          <select name="supplier" defaultValue={query.supplier || ""}>
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Status
          <select name="status" defaultValue={query.status || ""}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button className="button primary" type="submit">
          Filter
        </button>
      </form>
      <OrderTable orders={orders} hrefBase="/office/orders" mode="office" />
    </>
  );
}
