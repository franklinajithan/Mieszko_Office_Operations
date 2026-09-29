import { describe, expect, it } from "vitest";
import { canAccessAdmin, canAccessOrder, homePath } from "./access";
import { formatUkDate } from "./format";
import { isWholeQuantity, orderSubject, productMatches, sendBlockReason, summarize } from "./order-rules";
import { isSixDigitPin, pinCooldownActive } from "./pin";

describe("PIN login", () => {
  it("accepts only a 6-digit PIN", () => {
    expect(isSixDigitPin("123456")).toBe(true);
    expect(isSixDigitPin("12345")).toBe(false);
    expect(isSixDigitPin("abcdef")).toBe(false);
  });

  it("slows repeated failures without a permanent lock", () => {
    expect(pinCooldownActive(8, 10)).toBe(true);
    expect(pinCooldownActive(8, 61)).toBe(false);
  });
});

describe("shop access", () => {
  it("resolves the shop from the role and keeps stores apart", () => {
    expect(homePath("store")).toBe("/shop");
    expect(homePath("office")).toBe("/office");
    expect(canAccessOrder({ role: "store", storeId: "hounslow" }, "hounslow")).toBe(true);
    expect(canAccessOrder({ role: "store", storeId: "hounslow" }, "hayes")).toBe(false);
    expect(canAccessOrder({ role: "office", storeId: null }, "hayes")).toBe(true);
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("office")).toBe(false);
  });
});

describe("supplier order", () => {
  it("counts only quantities above zero", () => {
    expect(summarize([
      { quantity: 5 },
      { quantity: 0 },
      { quantity: 3 },
      { quantity: 10 },
    ])).toEqual({ products: 3, quantity: 18 });
  });

  it("rejects a send with no date or no quantities", () => {
    expect(sendBlockReason({ status: "draft", deliveryDate: null, lines: [{ quantity: 2 }] })).toMatch(/delivery date/i);
    expect(sendBlockReason({ status: "draft", deliveryDate: "2026-10-01", lines: [{ quantity: 0 }] })).toMatch(/at least one product/i);
    expect(sendBlockReason({ status: "draft", deliveryDate: "2026-10-01", lines: [{ quantity: 5 }] })).toBeNull();
    expect(sendBlockReason({ status: "submitted", deliveryDate: "2026-10-01", lines: [{ quantity: 5 }] })).toMatch(/already been sent/i);
  });

  it("accepts whole quantities only", () => {
    expect(isWholeQuantity(0)).toBe(true);
    expect(isWholeQuantity(5)).toBe(true);
    expect(isWholeQuantity(-1)).toBe(false);
    expect(isWholeQuantity(1.5)).toBe(false);
  });

  it("searches item code, EAN, supplier code and name", () => {
    const product = { name: "Polish Bread", itemCode: "12345", ean: "5901234567890", supplierCode: "ABC100" };
    expect(productMatches(product, "bread")).toBe(true);
    expect(productMatches(product, "590123")).toBe(true);
    expect(productMatches(product, "ABC100")).toBe(true);
    expect(productMatches(product, "12345")).toBe(true);
    expect(productMatches(product, "rolls")).toBe(false);
  });

  it("builds the supplier email subject from the shop and delivery date", () => {
    expect(orderSubject("Hounslow", "Polish Bakery", "01/10/2026")).toBe("Mieszko Order - Hounslow - Polish Bakery - Delivery 01/10/2026");
    expect(formatUkDate("2026-10-01")).toBe("01/10/2026");
  });
});
