import { Banner, PageIntro } from "@/components/ui";
import { saveAssignments } from "@/server/actions/admin";
import { listAssignments, listStores, listSuppliers } from "@/server/queries";

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const query = await searchParams;
  const [stores, suppliers, assignments] = await Promise.all([listStores(), listSuppliers(), listAssignments()]);
  const activeStores = stores.filter((store) => store.active);
  const activeSuppliers = suppliers.filter((supplier) => supplier.active);
  const lookup = new Map(assignments.map((row) => [`${row.storeId}|${row.supplierId}`, row]));
  const pairs = activeStores.flatMap((store) => activeSuppliers.map((supplier) => `${store.id}|${supplier.id}`));
  return (
    <>
      <PageIntro title="Assignments" text="A store only sees assigned suppliers. Missing-order reports use the same list. Products belong to one supplier." />
      <Banner notice={query.notice} error={query.error} />
      <form action={saveAssignments}>
        <input type="hidden" name="pairs" value={pairs.join(",")} />
        <div className="tableWrap">
          <table className="data">
            <thead><tr><th>Store</th><th>Supplier</th><th>Orders expected</th><th>Deadline</th></tr></thead>
            <tbody>
              {activeStores.flatMap((store) => activeSuppliers.map((supplier) => {
                const key = `${store.id}|${supplier.id}`;
                const row = lookup.get(key);
                return (
                  <tr key={key}>
                    <td data-label="Store">{store.name}{store.code ? ` · ${store.code}` : ""}</td>
                    <td data-label="Supplier">{supplier.name}</td>
                    <td data-label="Orders expected"><input type="checkbox" name="active" value={key} defaultChecked={row ? row.active : false} aria-label={`${store.name} orders from ${supplier.name}`} /></td>
                    <td data-label="Deadline"><input name={`deadline:${key}`} type="time" defaultValue={row?.orderDeadline || ""} aria-label={`Deadline for ${store.name} and ${supplier.name}`} /></td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="button primary" type="submit">Save assignments</button>
        </div>
      </form>
    </>
  );
}
