import type { Metadata } from "next";
export const metadata: Metadata = { title: "Smart Ordering Preview" };
export default function SmartOrderingPage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#fff8e7", color: "#7a4b00", padding: "12px 16px", border: "1px solid #f4d58d", borderRadius: 12, fontSize: 14 }}>
        <strong>UI prototype — no live data.</strong> Sample products and browser-local edits only. Supplier orders cannot be sent from this preview. PostgreSQL integration is pending.
      </div>
      <iframe
        title="Mieszko Smart Ordering UI"
        src="/ordering/index.html"
        style={{ display: "block", width: "100%", height: "min(1050px, 85vh)", minHeight: 650, border: "1px solid #e1e6ee", borderRadius: 14, background: "#f5f7fb" }}
      />
    </div>
  );
}
