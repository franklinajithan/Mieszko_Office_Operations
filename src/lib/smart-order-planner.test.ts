import { describe, expect, it } from "vitest";
import { planSupplierOrders, type SupplierOffer } from "./smart-order-planner";

const offers: SupplierOffer[] = [
  { supplier: "Spizarnia", supplierCode: "SP-A", mspItemCode: "100", netCasePrice: 12, unitsPerCase: 12, available: true },
  { supplier: "Mastermedia", supplierCode: "MM-A", mspItemCode: "100", netCasePrice: 11, unitsPerCase: 10, available: true },
  { supplier: "Wabar", supplierCode: "WB-A", mspItemCode: "100", netCasePrice: 9, unitsPerCase: 6, available: true },
];

describe("smart supplier planner", () => {
  it("compares rounded case totals rather than nominal unit prices", () => {
    const result = planSupplierOrders([{ store: "Hounslow", mspItemCode: "100", requiredUnits: 12 }], offers);
    expect(result.allocations[0]).toMatchObject({ supplier: "Spizarnia", cases: 1, orderedUnits: 12, lineTotal: 12 });
    expect(result.issues).toEqual([]);
  });
  it("excludes unavailable suppliers", () => {
    const result = planSupplierOrders([{ store: "Hayes", mspItemCode: "100", requiredUnits: 10 }],
      offers.map(o => ({ ...o, available: o.supplier === "Mastermedia" })));
    expect(result.allocations[0].supplier).toBe("Mastermedia");
  });
  it("reallocates when a supplier fails its minimum order", () => {
    const result = planSupplierOrders([{ store: "Hounslow", mspItemCode: "100", requiredUnits: 12 }],
      offers.map(o => o.supplier === "Spizarnia" ? { ...o, minimumOrderValue: 100 } : o));
    expect(result.allocations[0].supplier).toBe("Mastermedia");
  });
  it("does not create orders for unknown products", () => {
    const result = planSupplierOrders([{ store: "Watford", mspItemCode: "999", requiredUnits: 12 }], offers);
    expect(result.allocations).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });
  it("aggregates repeated requirements for the same store and item", () => {
    const result = planSupplierOrders([
      { store: "Hounslow", mspItemCode: "100", requiredUnits: 6 },
      { store: "Hounslow", mspItemCode: "100", requiredUnits: 6 },
    ], offers);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].orderedUnits).toBe(12);
  });
});
