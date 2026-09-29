import { EmptyState, PageIntro } from "@/components/ui";
import { londonToday, storeLabel } from "@/lib/format";
import { listMissingOrders } from "@/server/queries";

export default async function MissingOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const query = await searchParams;
  const targetDate = query.date || londonToday();
  const missing = await listMissingOrders(targetDate);

  return (
    <>
      <PageIntro
        title="Missing orders"
        text="Expected orders that haven't been submitted based on active assignments."
      />
      <form className="filters" method="get">
        <label className="field">
          Order date
          <input type="date" name="date" defaultValue={targetDate} />
        </label>
        <button className="button primary" type="submit">
          Check date
        </button>
      </form>
      {missing.length === 0 ? (
        <EmptyState
          title="All expected orders received"
          text={`Every active shop-supplier assignment has an order for ${targetDate}.`}
        />
      ) : (
        <div className="tableWrap">
          <table className="data">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Supplier</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((row) => {
                const key = `${row.storeId}|${row.supplierId}`;
                return (
                  <tr key={key}>
                    <td data-label="Shop">
                      {storeLabel(row.storeName, row.storeCode)}
                    </td>
                    <td data-label="Supplier">{row.supplierName}</td>
                    <td data-label="Deadline">
                      {row.deadline || <span className="muted">No deadline</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
