import { EmptyState, PageIntro } from "@/components/ui";
import { formatUkDateTime } from "@/lib/format";
import { listAudit } from "@/server/queries";

export default async function AuditPage() {
  const rows = await listAudit();
  return (
    <>
      <PageIntro title="Audit history" text="PINs, session tokens and service keys are not recorded." />
      {rows.length === 0 ? <EmptyState title="No activity yet" text="Submissions, PIN changes, exports and emails will appear here." /> : (
        <div className="tableWrap">
          <table className="data">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="When">{formatUkDateTime(row.createdAt)}</td>
                  <td data-label="Who">{row.actorName || "Staff"}{row.actorRole ? ` · ${row.actorRole}` : ""}</td>
                  <td data-label="Action">{row.action.replaceAll("_", " ")}</td>
                  <td data-label="Record">{row.entityType}{row.entityId ? ` ${row.entityId.slice(0, 8)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
