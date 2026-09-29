import Link from "next/link";
import { EmptyState, PageIntro } from "@/components/ui";
import { consolidate, storeColumnLabel } from "@/lib/consolidation";
import { londonToday } from "@/lib/format";
import { getConsolidationData, listSuppliers } from "@/server/queries";

export default async function ConsolidatePage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; date?: string; delivery?: string }>;
}) {
  const query = await searchParams;
  const suppliers = await listSuppliers();
  const activeSuppliers = suppliers.filter((s) => s.active);

  let consolidationData = null;
  if (query.supplier) {
    const lines = await getConsolidationData({
      supplierId: query.supplier,
      orderDate: query.date || undefined,
      deliveryDate: query.delivery || undefined,
    });

    const casesData = lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      itemCode: line.itemCode,
      barcode: line.barcode,
      caseSize: line.caseSize,
      storeId: line.storeId,
      storeName: line.storeName,
      storeCode: line.storeCode,
      cases: line.quantity,
    }));

    consolidationData = consolidate(casesData);
  }

  const selectedSupplier = suppliers.find((s) => s.id === query.supplier);

  return (
    <>
      <PageIntro
        title="Consolidate orders"
        text="Combine orders from multiple shops for the same supplier."
      />
      <form className="filters" method="get">
        <label className="field">
          Supplier
          <select name="supplier" defaultValue={query.supplier || ""} required>
            <option value="">Select supplier</option>
            {activeSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Order date
          <input type="date" name="date" defaultValue={query.date || ""} />
        </label>
        <label className="field">
          Delivery date
          <input type="date" name="delivery" defaultValue={query.delivery || ""} />
        </label>
        <button className="button primary" type="submit">
          Consolidate
        </button>
        {query.supplier && (
          <Link
            className="button secondary"
            href={`/api/export/consolidation?supplier=${query.supplier}${
              query.date ? `&date=${query.date}` : ""
            }${query.delivery ? `&delivery=${query.delivery}` : ""}`}
          >
            Export to Excel
          </Link>
        )}
      </form>

      {!query.supplier ? (
        <EmptyState
          title="Select a supplier"
          text="Choose a supplier and optional date filters to consolidate orders."
        />
      ) : !consolidationData || consolidationData.rows.length === 0 ? (
        <EmptyState
          title="No orders found"
          text={`No active orders found for ${selectedSupplier?.name || "this supplier"} with the selected filters.`}
        />
      ) : (
        <div className="tableWrap">
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                <th>Item Code</th>
                <th>Barcode</th>
                <th>Case Size</th>
                {consolidationData.stores.map((store) => (
                  <th key={store.id}>{storeColumnLabel(store)}</th>
                ))}
                <th>Total Cases</th>
                <th>Total Units</th>
              </tr>
            </thead>
            <tbody>
              {consolidationData.rows.map((row) => (
                <tr key={row.productId}>
                  <td data-label="Product">{row.productName}</td>
                  <td data-label="Item Code">
                    {row.itemCode || <span className="muted">—</span>}
                  </td>
                  <td data-label="Barcode">
                    {row.barcode || <span className="muted">—</span>}
                  </td>
                  <td data-label="Case Size">{row.caseSize}</td>
                  {consolidationData.stores.map((store) => (
                    <td key={store.id} data-label={storeColumnLabel(store)}>
                      {row.byStore[store.id] || <span className="muted">—</span>}
                    </td>
                  ))}
                  <td data-label="Total Cases">
                    <strong>{row.totalCases}</strong>
                  </td>
                  <td data-label="Total Units">
                    <strong>{row.totalUnits}</strong>
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
