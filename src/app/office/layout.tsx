import { OfficeShell } from "@/components/shells";
import { requireOffice } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireOffice();
  return <OfficeShell staff={staff}>{children}</OfficeShell>;
}
