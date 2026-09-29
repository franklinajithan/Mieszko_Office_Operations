import type { ReactNode } from "react";
import { ClipboardList, LogOut, Settings, Users, PackagePlus, Store, Mail } from "lucide-react";
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
          <form action={signOut} className="mobileOnly">
            <button className="button secondary" type="submit">Sign out</button>
          </form>
        </header>
        <div className="content">{children}</div>
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
        <div>
          <p className="eyebrow">Mieszko Office Operations</p>
          <h1>{storeName}</h1>
          {storeCode && <p>Store {storeCode}</p>}
        </div>
        <form action={signOut}>
          <button className="button secondary" type="submit">Sign out</button>
        </form>
      </header>
      <div className="content">{children}</div>
      <nav className="bottomNav" aria-label="Shop">
        <NavLink href="/shop/new" exact={false}>New order</NavLink>
        <NavLink href="/shop/history" exact={false}>Order history</NavLink>
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
