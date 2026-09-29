import { EmptyState, PageIntro } from "@/components/ui";
import { formatUkDate } from "@/lib/format";
import { getProductOrderSummary, listSuppliers } from "@/server/queries";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    supplier?: string;
  }>;
}) {
  const query = await searchParams;
  const [products, suppliers] = await Promise.all([
    getProductOrderSummary({
      startDate: query.startDate || undefined,
      endDate: query.endDate || undefined,
      supplierId: query.supplier || undefined,
    }),
    listSuppliers(),
  ]);

  return (
    <>
      <PageIntro
        title="Stock overview"
        text="Product ordering patterns and quantities."
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
          Update view
        </button>
      </form>

      {products.length === 0 ? (
        <EmptyState
          title="No products ordered"
          text="No products match the selected filters."
        />
      ) : (
        <div className="tableWrap">
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                <th>Item Code</th>
                <th>EAN</th>
                <th>Supplier</th>
                <th>Case Size</th>
                <th>Orders</th>
                <th>Total Qty</th>
                <th>Total Units</th>
                <th>Last Ordered</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.productId}>
                  <td data-label="Product">{product.productName}</td>
                  <td data-label="Item Code">
                    {product.itemCode || <span className="muted">—</span>}
                  </td>
                  <td data-label="EAN">
                    {product.ean || <span className="muted">—</span>}
                  </td>
                  <td data-label="Supplier">{product.supplierName}</td>
                  <td data-label="Case Size">{product.caseSize}</td>
                  <td data-label="Orders">{product.totalOrders}</td>
                  <td data-label="Total Qty">
                    <strong>{product.totalQuantity}</strong>
                  </td>
                  <td data-label="Total Units">
                    <strong>
                      {(product.totalQuantity * product.caseSize).toLocaleString()}
                    </strong>
                  </td>
                  <td data-label="Last Ordered">
                    {product.lastOrderDate ? (
                      formatUkDate(product.lastOrderDate)
                    ) : (
                      <span className="muted">Never</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
