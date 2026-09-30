import { SuppliersGrid } from "@/components/data-grids";
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
      <PageIntro title="Suppliers" text="Add a supplier or select Edit below to update its order email and CC addresses." />
      <Banner notice={query.notice} error={query.error} />
      <form className="panel formGrid" action={saveSupplier}>
        <div className="wide"><h2 style={{margin:"0 0 4px"}}>{editing ? `Edit supplier — ${editing.name}` : "Add supplier"}</h2>{!editing && <p className="muted" style={{margin:0}}>Create a new supplier here. To change an existing supplier, tap Edit in the list below.</p>}</div>
        <input type="hidden" name="id" value={editing?.id || ""} />
        <label className="field">Name<input name="name" defaultValue={editing?.name || ""} required /></label>
        <label className="field">Order email<input name="order_email" type="email" defaultValue={editing?.orderEmail || ""} /></label>
        <label className="field wide">CC emails<input name="cc_emails" defaultValue={editing?.ccEmails.join(", ") || ""} placeholder="optional@supplier.co.uk" /></label>
        <div className="wide"><h2 style={{margin:"6px 0 8px"}}>Email columns</h2><p className="muted" style={{margin:"0 0 10px"}}>Choose exactly what this supplier sees in order emails.</p><div className="emailColumnChecks">
<label className="check"><input type="checkbox" name="show_item_code" defaultChecked={editing?.emailColumns.itemCode ?? false} /> Item code</label>
<label className="check"><input type="checkbox" name="show_ean" defaultChecked={editing?.emailColumns.ean ?? false} /> EAN</label>
<label className="check"><input type="checkbox" name="show_supplier_code" defaultChecked={editing?.emailColumns.supplierCode ?? true} /> Supplier code</label>
<label className="check"><input type="checkbox" name="show_product_name" defaultChecked={editing?.emailColumns.productName ?? true} /> Product name</label>
<label className="check"><input type="checkbox" name="show_polish_name" defaultChecked={editing?.emailColumns.polishName ?? false} /> Polish name</label>
<label className="check"><input type="checkbox" name="show_quantity" defaultChecked={editing?.emailColumns.quantity ?? true} /> Quantity</label></div></div>
        <label className="check"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /> Active</label>
        <div className="actions wide">
          <button className="button primary" type="submit">{editing ? "Save changes" : "Add supplier"}</button>
          {editing && <Link className="button secondary" href="/admin/suppliers">Cancel</Link>}
        </div>
      </form>
      <SuppliersGrid suppliers={suppliers} />
    </>
  );
}
