import Link from "next/link";
import { Banner, PageIntro } from "@/components/ui";
import { saveSupplier, setSupplierActive } from "@/server/actions/admin";
import { listSuppliers } from "@/server/queries";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ edit?: string; notice?: string; error?: string }> }) {
  const query = await searchParams;
  const suppliers = await listSuppliers();
  const editing = suppliers.find((supplier) => supplier.id === query.edit);
  return (
    <>
      <PageIntro title="Suppliers" text="Orders are emailed to the supplier. The shop email receives a copy." />
      <Banner notice={query.notice} error={query.error} />
      <form className="panel formGrid" action={saveSupplier}>
        <input type="hidden" name="id" value={editing?.id || ""} />
        <label className="field">Name<input name="name" defaultValue={editing?.name || ""} required /></label>
        <label className="field">Order email<input name="order_email" type="email" defaultValue={editing?.orderEmail || ""} /></label>
        <label className="field wide">CC emails<input name="cc_emails" defaultValue={editing?.ccEmails.join(", ") || ""} placeholder="optional@supplier.co.uk" /></label>
        <label className="check"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /> Active</label>
        <div className="actions wide">
          <button className="button primary" type="submit">{editing ? "Save supplier" : "Add supplier"}</button>
          {editing && <Link className="button secondary" href="/admin/suppliers">Cancel</Link>}
        </div>
      </form>
      <div className="adminGrid">
        {suppliers.map((supplier) => (
          <div className="adminRow" key={supplier.id}>
            <div>
              <b>{supplier.name}</b>
              <p className="muted">{supplier.active ? "Active" : "Inactive"} · {supplier.orderEmail || "No order email"}</p>
            </div>
            <div className="actions">
              <Link className="button secondary" href={`/admin/suppliers?edit=${supplier.id}`}>Edit</Link>
              <form action={setSupplierActive}>
                <input type="hidden" name="id" value={supplier.id} />
                <input type="hidden" name="active" value={supplier.active ? "false" : "true"} />
                <button className="button secondary" type="submit">{supplier.active ? "Deactivate" : "Activate"}</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
