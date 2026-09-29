import { ProductsGrid } from "@/components/data-grids";
import Link from "next/link";
import { Banner, EmptyState, PageIntro } from "@/components/ui";
import { saveProduct, setProductActive } from "@/server/actions/admin";
import { getProduct, listProducts, listSuppliers } from "@/server/queries";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ edit?: string; q?: string; supplier?: string; notice?: string; error?: string }> }) {
  const query = await searchParams;
  const [products, suppliers] = await Promise.all([
    listProducts({ search: query.q, supplierId: query.supplier }),
    listSuppliers(),
  ]);
  const editing = query.edit ? products.find((product) => product.id === query.edit) || await getProduct(query.edit) : null;
  return (
    <>
      <PageIntro title="Products" text="Item code, EAN, supplier code and product name. Excel import can use those columns plus the supplier name." />
      <Banner notice={query.notice} error={query.error} />
      <form className="filters" method="get">
        <label className="field">Search<input name="q" defaultValue={query.q || ""} placeholder="Item code, EAN, supplier code or name" /></label>
        <label className="field">Supplier
          <select name="supplier" defaultValue={query.supplier || ""}>
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <button className="button primary" type="submit">Search</button>
      </form>
      <form className="panel formGrid" action={saveProduct}>
        <input type="hidden" name="id" value={editing?.id || ""} />
        <label className="field">English product name<input name="name" defaultValue={editing?.name || ""} required /></label>
        <label className="field">Polish product name<input name="polish_name" defaultValue={editing?.polishName || ""} /></label>
        <label className="field">Supplier
          <select name="supplier_id" defaultValue={editing?.supplierId || query.supplier || ""} required>
            <option value="">Choose</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className="field">Item code<input name="item_code" defaultValue={editing?.itemCode || ""} /></label>
        <label className="field">EAN<input name="ean" defaultValue={editing?.ean || ""} /></label>
        <label className="field">Supplier code<input name="supplier_code" defaultValue={editing?.supplierCode || ""} /></label>
        <label className="check"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /> Active</label>
        <div className="actions wide">
          <button className="button primary" type="submit">{editing ? "Save product" : "Add product"}</button>
          {editing && <Link className="button secondary" href="/admin/products">Cancel</Link>}
        </div>
      </form>
      <ProductsGrid products={products} query={query} />
    </>
  );
}
