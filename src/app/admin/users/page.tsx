import { UsersGrid } from "@/components/data-grids";
import Link from "next/link";
import { Banner, PageIntro } from "@/components/ui";
import { formatUkDateTime, roleLabel } from "@/lib/format";
import { changePin, revokeUserSessions, saveUser, setUserActive } from "@/server/actions/admin";
import { listStores, listUsers } from "@/server/queries";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ edit?: string; notice?: string; error?: string }> }) {
  const query = await searchParams;
  const [users, stores] = await Promise.all([listUsers(), listStores()]);
  const editing = users.find((user) => user.userId === query.edit);
  return (
    <>
      <PageIntro title="Users" text="A PIN is the password. It is stored as a hash and is never shown again." />
      <Banner notice={query.notice} error={query.error} />
      <form className="panel formGrid" action={saveUser}>
        <input type="hidden" name="id" value={editing?.userId || ""} />
        <label className="field">Name<input name="name" defaultValue={editing?.fullName || ""} required /></label>
        <label className="field">Role
          <select name="role" defaultValue={editing?.role || "store"}>
            <option value="store">Store</option>
            <option value="office">Office</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="field">Store
          <select name="store_id" defaultValue={editing?.storeId || ""}>
            <option value="">No store</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.code ? ` (${store.code})` : ""}</option>)}
          </select>
        </label>
        {!editing && <label className="field">6-digit PIN<input name="pin" inputMode="numeric" minLength={6} maxLength={6} pattern="[0-9]{6}" required /></label>}
        <label className="check"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /> Active</label>
        <div className="actions wide">
          <button className="button primary" type="submit">{editing ? "Save user" : "Add user"}</button>
          {editing && <Link className="button secondary" href="/admin/users">Cancel</Link>}
        </div>
      </form>
      {editing && (
        <div className="split" style={{ marginTop: 16 }}>
          <form className="panel formGrid" action={changePin}>
            <input type="hidden" name="id" value={editing.userId} />
            <label className="field">New PIN<input name="pin" type="password" inputMode="numeric" minLength={6} maxLength={6} required /></label>
            <label className="field">Confirm PIN<input name="confirm" type="password" inputMode="numeric" minLength={6} maxLength={6} required /></label>
            <div className="wide"><button className="button primary" type="submit">Change PIN</button></div>
          </form>
          <form className="panel" action={revokeUserSessions}>
            <input type="hidden" name="id" value={editing.userId} />
            <h2>Sessions</h2>
            <p className="muted">Sign this user out of every browser.</p>
            <button className="button secondary" type="submit">Sign out sessions</button>
          </form>
        </div>
      )}
      <UsersGrid users={users} />
    </>
  );
}
