import type { ReactNode } from "react";
import { ClipboardList, LogOut, Settings, Users, PackagePlus, Store, Mail, Home, PlusCircle, History } from "lucide-react";
import { signOut } from "@/server/actions/auth";
import type { Staff } from "@/server/session";
import { NavLink } from "./controls";

const OFFICE_NAV = [
  { href: "/office", label: "Orders", icon: ClipboardList, exact: true, adminOnly: false, nested: false },
  { href: "/admin", label: "Administration", icon: Settings, exact: true, adminOnly: true, nested: false },
  { href: "/admin/users", label: "Users", icon: Users, exact: false, adminOnly: true, nested: true },
  { href: "/admin/products", label: "Products", icon: PackagePlus, exact: false, adminOnly: true, nested: true },
  { href: "/admin/suppliers", label: "Suppliers & emails", icon: Mail, exact: false, adminOnly: true, nested: true },
  { href: "/admin/stores", label: "Shops & emails", icon: Store, exact: false, adminOnly: true, nested: true },
];

export function OfficeShell({ staff, children }: { staff: Staff; children: ReactNode }) {
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="mark" aria-hidden="true">M</div>
          <div>
            <b>Mieszko</b>
            <span>Office Operations</span>
          </div>
        </div>
        <nav aria-label="Head Office">
          {OFFICE_NAV.filter((item) => !item.adminOnly || staff.role === "admin").map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.href} href={item.href} exact={item.exact}>
                <span className={item.nested ? "nested" : "navItem"}><Icon size={18} aria-hidden="true" />{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <form action={signOut} className="navBottom">
          <button type="submit"><LogOut size={18} aria-hidden="true" />Sign out</button>
        </form>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Head Office</p>
            <strong>{staff.fullName}</strong>
          </div>
          <div className="topbarIdentity"><span className="onlineDot" />{staff.role === "admin" ? "Administrator" : "Office user"}</div>
        </header>
        <div className="content">{children}</div>
        <nav className="officeBottomNav" aria-label="Head Office mobile navigation">
          <NavLink href="/office" exact><ClipboardList size={20} /><span>Orders</span></NavLink>
          {staff.role === "admin" && <NavLink href="/admin" exact={false}><Settings size={20} /><span>Admin</span></NavLink>}
          <form action={signOut}><button type="submit"><LogOut size={20} /><span>Sign out</span></button></form>
        </nav>
      </div>
    </div>
  );
}

export function ShopShell({
  storeName,
  storeCode,
  children,
}: {
  storeName: string;
  storeCode: string | null;
  children: ReactNode;
}) {
  return (
    <div className="shopShell">
      <header className="shopHeader">
        <div className="shopIdentity">
          <div className="shopAvatar">{storeName.slice(0,1)}</div>
          <div><p className="eyebrow">Mieszko Orders</p><h1>{storeName}</h1>{storeCode && <p>Store {storeCode}</p>}</div>
        </div>
        <form action={signOut}><button className="iconButton" type="submit" aria-label="Sign out"><LogOut size={20} /></button></form>
      </header>
      <div className="content">{children}</div>
      <nav className="bottomNav" aria-label="Shop">
        <NavLink href="/shop/new" exact={false}><PlusCircle size={21}/><span>New order</span></NavLink>
        <a href="/shop/history"><History size={21}/><span>History</span></a>
      </nav>
    </div>
  );
}

export function AdminNav() {
  const links = [
    ["/admin/stores", "Shops"],
    ["/admin/suppliers", "Suppliers"],
    ["/admin/products", "Products"],
    ["/admin/users", "Users / PINs"],
  ] as const;
  return (
    <nav className="subnav" aria-label="Administration">
      {links.map(([href, label]) => <NavLink key={href} href={href}>{label}</NavLink>)}
    </nav>
  );
}
