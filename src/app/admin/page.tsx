import Link from "next/link";
import { PackagePlus, Store, Truck, Users, ChevronRight } from "lucide-react";
import { PageIntro } from "@/components/ui";

const LINKS = [
  ["/admin/users", "Users & PINs", "Staff access, roles and shop assignment.", Users],
  ["/admin/products", "Products", "Catalogue, English/Polish names, codes and EAN.", PackagePlus],
  ["/admin/suppliers", "Suppliers", "Supplier details and ordering email addresses.", Truck],
  ["/admin/stores", "Shops", "Store details and order-copy email addresses.", Store],
] as const;

export default function AdminHome() {
  return (
    <>
      <PageIntro title="Administration" text="Manage the ordering platform from one place." />
      <div className="adminFeatureGrid">
        {LINKS.map(([href, title, description, Icon]) => (
          <Link className="adminFeatureCard" key={href} href={href}>
            <span className="featureIcon"><Icon size={22} /></span>
            <span className="featureCopy"><b>{title}</b><small>{description}</small></span>
            <ChevronRight className="featureArrow" size={20} />
          </Link>
        ))}
      </div>
    </>
  );
}
