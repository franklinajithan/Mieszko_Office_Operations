import Link from "next/link";
import { PageIntro } from "@/components/ui";

const LINKS = [
  ["/admin/users", "Create / Manage Users", "Create shop, office and admin users; assign shops and manage 6-digit PINs."],
  ["/admin/products", "Add / Manage Products", "Add products with English/Polish names, item code, EAN and supplier code."],
  ["/admin/suppliers", "Supplier Manager", "Add suppliers and manage supplier order/CC email addresses."],
  ["/admin/stores", "Shop Email Manager", "Manage shop email addresses used for order copies."],

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
