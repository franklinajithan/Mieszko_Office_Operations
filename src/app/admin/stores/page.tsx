import { ShopsGrid } from "@/components/data-grids";
import Link from "next/link";
import { Banner, PageIntro } from "@/components/ui";
import { saveStore, setStoreActive } from "@/server/actions/admin";
import { listStores } from "@/server/queries";

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ edit?: string; notice?: string; error?: string }> }) {
  const query = await searchParams;
  const stores = await listStores();
  const editing = stores.find((store) => store.id === query.edit);
  return (
    <>
      <PageIntro title="Shops" text="Manage store details and ordering access." />
      <Banner notice={query.notice} error={query.error} />
      <form className="panel formGrid adminStoreForm" action={saveStore}>
        <input type="hidden" name="id" value={editing?.id || ""} />
        <label className="field">Store name<input name="name" defaultValue={editing?.name || ""} required /></label>
        <label className="field">Store code<input name="code" defaultValue={editing?.code || ""} inputMode="numeric" placeholder="Leave blank if unknown" /></label>
        <label className="field">Shop email<input name="email" type="email" defaultValue={editing?.email || ""} placeholder="orders@shop.example" /></label>
        <label className="check"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /> Active</label>
        <div className="actions wide">
          <button className="button primary" type="submit">{editing ? "Save store" : "Add store"}</button>
          {editing && <Link className="button secondary" href="/admin/stores">Cancel</Link>}
        </div>
      </form>
      <ShopsGrid stores={stores} />
    </>
  );
}
