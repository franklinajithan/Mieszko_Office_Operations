import "server-only";
import { db } from "./db";
import { isMissingRelation, logServerError } from "./errors";
import type { Staff } from "./session";

type AuditInput = {
  staff: Pick<Staff, "userId" | "fullName" | "role" | "storeId">;
  action: string;
  entityType: string;
  entityId?: string | null;
  storeId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput) {
  const metadata = input.metadata ?? {};
  const forbidden = ["pin", "pin_hash", "token", "token_hash", "password", "service_role", "api_key"];
  for (const key of Object.keys(metadata)) {
    if (forbidden.some((word) => key.toLowerCase().includes(word))) {
      delete metadata[key];
    }
  }
  const { error } = await db().from("audit_log").insert({
    actor_id: input.staff.userId,
    actor_name: input.staff.fullName,
    actor_role: input.staff.role,
    store_id: input.storeId ?? input.staff.storeId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata,
  });
  if (error && !isMissingRelation(error)) logServerError("audit", error.message);
}
