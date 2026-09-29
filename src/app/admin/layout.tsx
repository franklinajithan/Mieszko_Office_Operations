import { AdminNav, OfficeShell } from "@/components/shells";
import { requireAdmin } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireAdmin();
  return (
    <OfficeShell staff={staff}>
      <AdminNav />
      {children}
    </OfficeShell>
  );
}
