import { describe, expect, it } from "vitest";
import { dispatchOrderEmails, type OutboundEmail } from "./order-dispatch";
import { orderPdfFilename, type EmailOrder } from "./order-message";
import { canResendShopCopy, canResendSupplier, shopCopyLabel, supplierChannelLabel } from "./order-email-status";
import { resolveTemplateId } from "@/server/pdf/templates/registry";

function sampleOrder(overrides: Partial<EmailOrder> = {}): EmailOrder {
  return {
    id: "order-0766",
    storeId: "store-perivale",
    storeName: "Perivale",
    storeCode: "0766",
    storeEmail: "perivale@example.com",
    supplierName: "Polish Village Bread",
    supplierEmail: "orders@bread.example",
    supplierCc: ["buyer@bread.example", "perivale@example.com", "orders@bread.example"],
    orderDate: "2026-09-29",
    deliveryDate: "2026-10-08",
    lines: [
      { itemCode: "1029", ean: "590111", supplierCode: "PVB-1", name: "100% RYE YEAST FREE BREAD", polishName: "CHLEB 100% ŻYTNI BEZ DROŻDŻY", quantity: 6 },
      { itemCode: "0000", ean: "000", supplierCode: "ZERO", name: "ZERO BREAD", polishName: null, quantity: 0 },
      { itemCode: "1044", ean: "590222", supplierCode: "PVB-2", name: "Rye with cranberry", polishName: "Bułeczki drożdżowe", quantity: 2 },
    ],
    ...overrides,
  };
}

function recorder() {
  const sent: OutboundEmail[] = [];
  return {
    sent,
    send: async (message: OutboundEmail) => {
      sent.push(message);
      return { id: `msg-${sent.length}` };
    },
  };
}

describe("order email dispatch", () => {
  it("sends the supplier only quantities above zero and no PDF", async () => {
    const mail = recorder();
    const result = await dispatchOrderEmails({
      order: sampleOrder(),
      from: "Mieszko Operations <mieszkooperations@gmail.com>",
      target: "both",
      send: mail.send,
      renderPdf: async () => ({ filename: "shop.pdf", content: new Uint8Array([1, 2, 3]) }),
    });

    expect(result.keepSubmittedOrder).toBe(true);
    expect(result.supplier.status).toBe("sent");
    expect(mail.sent[0].to).toBe("orders@bread.example");
    expect(mail.sent[0].cc).toEqual(["buyer@bread.example"]);
    expect(mail.sent[0].subject).toBe("Mieszko Order - Perivale - Polish Village Bread - Delivery 08/10/2026");
    expect(mail.sent[0].html).toContain("100% RYE YEAST FREE BREAD");
    expect(mail.sent[0].html).toContain("Rye with cranberry");
    expect(mail.sent[0].html).not.toContain("ZERO BREAD");
    expect(mail.sent[0].html).toContain("Shop code:");
    expect(mail.sent[0].html).toContain("29/09/2026");
    expect(mail.sent[0].html).toContain("Total Products:");
    expect(mail.sent[0].html).toContain("Total Qty:</b> 8");
    expect(mail.sent[0].attachments).toEqual([]);
    expect(mail.sent[0].html).not.toContain("PDF is attached");
  });

  it("sends the shop a separate email with the PDF attached", async () => {
    const mail = recorder();
    const result = await dispatchOrderEmails({
      order: sampleOrder(),
      from: "Mieszko Operations <mieszkooperations@gmail.com>",
      target: "both",
      send: mail.send,
      renderPdf: async (order) => ({ filename: orderPdfFilename(order), content: Uint8Array.from([37, 80, 68, 70]) }),
    });

    expect(mail.sent).toHaveLength(2);
    expect(mail.sent[1].to).toBe("perivale@example.com");
    expect(mail.sent[1].cc).toEqual([]);
    expect(mail.sent[1].subject).toBe("Copy: Mieszko Order - Perivale - Polish Village Bread - Delivery 08/10/2026");
    expect(mail.sent[1].html).toContain("PDF is attached");
    expect(mail.sent[1].attachments[0].filename).toBe("Mieszko-Order-0766-Polish-Village-Bread-08-10-2026.pdf");
    expect(mail.sent[1].attachments[0].content.byteLength).toBeGreaterThan(0);
    expect(result.shop.status).toBe("sent");
  });

  it("still sends the supplier email when the shop email is missing", async () => {
    const mail = recorder();
    const result = await dispatchOrderEmails({
      order: sampleOrder({ storeEmail: null }),
      from: "Mieszko Operations <mieszkooperations@gmail.com>",
      target: "both",
      send: mail.send,
      renderPdf: async () => { throw new Error("PDF should not be required"); },
    });

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("orders@bread.example");
    expect(result.supplier.status).toBe("sent");
    expect(result.shop.status).toBe("missing");
    expect(result.shop.error).toBe("Shop email not configured");
    expect(result.keepSubmittedOrder).toBe(true);
  });

  it("keeps the submitted order when the supplier email fails and does not send the shop copy", async () => {
    const result = await dispatchOrderEmails({
      order: sampleOrder(),
      from: "Mieszko Operations <mieszkooperations@gmail.com>",
      target: "both",
      send: async () => ({ error: "Mailbox rejected" }),
      renderPdf: async () => { throw new Error("PDF should not be created"); },
    });

    expect(result.keepSubmittedOrder).toBe(true);
    expect(result.supplier.status).toBe("failed");
    expect(result.supplier.error).toBe("Mailbox rejected");
    expect(result.shop.attempted).toBe(false);
    expect(result.updateSupplierStatus).toBe(true);
    expect(result.updateShopStatus).toBe(false);
  });

  it("does not change a successful supplier send when the shop copy fails", async () => {
    let calls = 0;
    const result = await dispatchOrderEmails({
      order: sampleOrder(),
      from: "Mieszko Operations <mieszkooperations@gmail.com>",
      target: "both",
      send: async () => {
        calls += 1;
        return calls === 1 ? { id: "supplier-msg" } : { error: "Shop mailbox full" };
      },
      renderPdf: async () => ({ filename: "shop.pdf", content: new Uint8Array([1]) }),
    });

    expect(result.supplier.status).toBe("sent");
    expect(result.shop.status).toBe("failed");
    expect(result.shop.error).toBe("Shop mailbox full");
    expect(result.updateSupplierStatus).toBe(true);
    expect(result.supplier.status).not.toBe("failed");
  });

  it("resends only the supplier email", async () => {
    const mail = recorder();
    const result = await dispatchOrderEmails({
      order: sampleOrder(),
      from: "Mieszko Operations <mieszkooperations@gmail.com>",
      target: "supplier",
      send: mail.send,
      renderPdf: async () => { throw new Error("Shop PDF must not be rendered"); },
    });

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("orders@bread.example");
    expect(mail.sent[0].attachments).toEqual([]);
    expect(result.supplier.status).toBe("sent");
    expect(result.shop.attempted).toBe(false);
    expect(result.updateShopStatus).toBe(false);
  });

  it("resends only the shop copy", async () => {
    const mail = recorder();
    const result = await dispatchOrderEmails({
      order: sampleOrder(),
      from: "Mieszko Operations <mieszkooperations@gmail.com>",
      target: "shop",
      send: mail.send,
      renderPdf: async (order) => ({ filename: orderPdfFilename(order), content: new Uint8Array([9]) }),
    });

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("perivale@example.com");
    expect(mail.sent[0].subject.startsWith("Copy:")).toBe(true);
    expect(mail.sent[0].attachments).toHaveLength(1);
    expect(result.supplier.attempted).toBe(false);
    expect(result.updateSupplierStatus).toBe(false);
    expect(result.shop.status).toBe("sent");
  });
});

describe("resend guards", () => {
  it("allows supplier and shop resends independently", () => {
    expect(canResendSupplier("failed", [])).toBe(true);
    expect(canResendSupplier("sent", [])).toBe(false);
    expect(canResendShopCopy("failed", "shop@example.com", [])).toBe(false);
    expect(canResendShopCopy("sent", "shop@example.com", [{ kind: "shop_order_copy", status: "failed" }])).toBe(true);
    expect(canResendShopCopy("sent", "shop@example.com", [{ kind: "shop_order_copy", status: "sent" }])).toBe(false);
    expect(canResendSupplier("sent", [{ kind: "supplier_order", status: "sent" }])).toBe(false);
  });

  it("shows a missing shop email without marking the supplier failed", () => {
    expect(supplierChannelLabel("sent", [])).toBe("Sent");
    expect(shopCopyLabel(null, [])).toBe("Shop email not configured");
    expect(shopCopyLabel("shop@example.com", [{ kind: "shop_order_copy", status: "missing", error: "Shop email not configured" }])).toBe("Shop email not configured");
    expect(shopCopyLabel("shop@example.com", [{ kind: "shop_order_copy", status: "failed", error: "Mailbox full" }])).toBe("Failed");
  });
});

describe("pdf templates", () => {
  it("selects a shop template by store id or code and falls back to default", () => {
    const assignments = [
      { storeCode: "0766", templateId: "perivale" as const },
      { storeId: "hounslow-id", templateId: "hounslow" as const },
    ];
    expect(resolveTemplateId({ id: "other", code: "0766" }, assignments)).toBe("perivale");
    expect(resolveTemplateId({ id: "hounslow-id", code: "0412" }, assignments)).toBe("hounslow");
    expect(resolveTemplateId({ id: "other", code: "9999" }, assignments)).toBe("default");
    expect(resolveTemplateId({ id: "store-perivale", code: "0766" })).toBe("default");
  });
});
