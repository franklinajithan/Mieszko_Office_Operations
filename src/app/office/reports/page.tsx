import { PageIntro } from "@/components/ui";
import { londonToday } from "@/lib/format";
import { getOrderStats, listStores, listSuppliers } from "@/server/queries";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    store?: string;
    supplier?: string;
  }>;
}) {
  const query = await searchParams;
  const [stats, stores, suppliers] = await Promise.all([
    getOrderStats({
      startDate: query.startDate || undefined,
      endDate: query.endDate || undefined,
      storeId: query.store || undefined,
      supplierId: query.supplier || undefined,
    }),
    listStores(),
    listSuppliers(),
  ]);

  return (
    <>
      <PageIntro
        title="Reports"
        text="Order statistics and insights for management."
      />
      <form className="filters" method="get">
        <label className="field">
          From date
          <input type="date" name="startDate" defaultValue={query.startDate || ""} />
        </label>
        <label className="field">
          To date
          <input type="date" name="endDate" defaultValue={query.endDate || ""} />
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
        <button className="button primary" type="submit">
          Update report
        </button>
      </form>

      <div className="statsGrid">
        <div className="statCard">
          <p className="statLabel">Total Orders</p>
          <p className="statValue">{stats.totalOrders}</p>
        </div>
        <div className="statCard">
          <p className="statLabel">Draft Orders</p>
          <p className="statValue">{stats.draftOrders}</p>
        </div>
        <div className="statCard">
          <p className="statLabel">Submitted Orders</p>
          <p className="statValue">{stats.submittedOrders}</p>
        </div>
        <div className="statCard">
          <p className="statLabel">Cancelled Orders</p>
          <p className="statValue">{stats.cancelledOrders}</p>
        </div>
        <div className="statCard">
          <p className="statLabel">Unique Products</p>
          <p className="statValue">{stats.totalProducts}</p>
        </div>
        <div className="statCard">
          <p className="statLabel">Total Quantity</p>
          <p className="statValue">{stats.totalQuantity.toLocaleString()}</p>
        </div>
        <div className="statCard">
          <p className="statLabel">Active Shops</p>
          <p className="statValue">{stats.storeCount}</p>
        </div>
        <div className="statCard">
          <p className="statLabel">Active Suppliers</p>
          <p className="statValue">{stats.supplierCount}</p>
        </div>
      </div>
    </>
  );
}
