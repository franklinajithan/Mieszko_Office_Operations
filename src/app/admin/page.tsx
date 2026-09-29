import Link from "next/link";
import { PageIntro } from "@/components/ui";

const LINKS = [
  ["/admin/stores", "Shops", "Name, store code, email and active status."],
  ["/admin/suppliers", "Suppliers", "Name and the order email address."],
  ["/admin/products", "Products", "Item code, EAN, supplier code and name."],
  ["/admin/users", "Users / PINs", "Name, role, shop and 6-digit PIN."],
] as const;

export default function AdminHome() {
  return (
    <>
      <PageIntro title="Administration" text="Shops, suppliers, products and PINs." />
      <div className="cards">
        {LINKS.map(([href, title, text]) => (
          <Link className="panel" key={href} href={href}><b>{title}</b><p className="muted">{text}</p></Link>
        ))}
      </div>
    </>
  );
}
