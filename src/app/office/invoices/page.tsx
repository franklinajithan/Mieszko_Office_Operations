import { EmptyState, PageIntro } from "@/components/ui";
import { formatUkDate, storeLabel } from "@/lib/format";
import { listOrders, listSuppliers } from "@/server/queries";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    supplier?: string;
  }>;
}) {
  const query = await searchParams;
  const [suppliers, orders] = await Promise.all([
    listSuppliers(),
    listOrders({
      status: "submitted",
      dateFrom: query.startDate || undefined,
      dateTo: query.endDate || undefined,
      supplierId: query.supplier || undefined,
    }),
  ]);

  const ordersBySupplier = new Map<
    string,
    {
      supplierName: string;
      orders: typeof orders;
      totalOrders: number;
      totalProducts: number;
      totalQuantity: number;
    }
  >();

  for (const order of orders) {
    let group = ordersBySupplier.get(order.supplierId);
    if (!group) {
      group = {
        supplierName: order.supplierName,
        orders: [],
        totalOrders: 0,
        totalProducts: 0,
        totalQuantity: 0,
      };
      ordersBySupplier.set(order.supplierId, group);
    }
    group.orders.push(order);
    group.totalOrders++;
    group.totalProducts += order.products;
    group.totalQuantity += order.totalQty;
  }

  const supplierGroups = Array.from(ordersBySupplier.values()).sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName)
  );

  return (
    <>
      <PageIntro
        title="Invoices"
        text="Submitted orders organized by supplier for invoicing."
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
          Filter
        </button>
      </form>

      {supplierGroups.length === 0 ? (
        <EmptyState
          title="No submitted orders"
          text="No submitted orders found for the selected filters."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {supplierGroups.map((group) => (
            <div key={group.supplierName} className="panel">
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, marginBottom: 8 }}>
                  {group.supplierName}
                </h2>
                <p className="muted">
                  {group.totalOrders} orders · {group.totalProducts} products ·{" "}
                  {group.totalQuantity.toLocaleString()} total quantity
                </p>
              </div>
              <div className="tableWrap" style={{ border: "none" }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Shop</th>
                      <th>Order Date</th>
                      <th>Delivery Date</th>
                      <th>Products</th>
                      <th>Quantity</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.orders.map((order) => (
                      <tr key={order.id} className="clickRow">
                        <td data-label="Shop">
                          <a
                            className="rowLink"
                            href={`/office/orders/${order.id}`}
                          >
                            {storeLabel(order.storeName, order.storeCode)}
                          </a>
                        </td>
                        <td data-label="Order Date">
                          {formatUkDate(order.orderDate)}
                        </td>
                        <td data-label="Delivery Date">
                          {order.deliveryDate ? (
                            formatUkDate(order.deliveryDate)
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td data-label="Products">{order.products}</td>
                        <td data-label="Quantity">
                          <strong>{order.totalQty}</strong>
                        </td>
                        <td data-label="Submitted">
                          {order.submittedAt ? (
                            formatUkDate(order.submittedAt)
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
