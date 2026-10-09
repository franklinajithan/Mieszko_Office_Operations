-- Audit trail for approval/rejection of supplier price lists.
CREATE TABLE IF NOT EXISTS office_ordering.price_approval_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 upload_id BIGINT NOT NULL REFERENCES office_ordering.price_uploads(id),
 old_status TEXT NOT NULL,
 new_status TEXT NOT NULL CHECK(new_status IN ('approved','rejected')),
 reviewed_by TEXT NOT NULL,
 reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS price_approval_audit_upload_idx ON office_ordering.price_approval_audit(upload_id,reviewed_at);
