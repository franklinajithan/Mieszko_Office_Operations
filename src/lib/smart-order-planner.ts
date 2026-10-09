export type SupplierOffer = {
  supplier: string;
  supplierCode: string;
  mspItemCode: string;
  netCasePrice: number;
  unitsPerCase: number;
  available: boolean;
  minimumOrderValue?: number;
  deliveryCharge?: number;
};
export type Requirement = { store: string; mspItemCode: string; requiredUnits: number };
export type Allocation = {
  store: string; mspItemCode: string; supplier: string; supplierCode: string;
  cases: number; orderedUnits: number; unitCost: number; lineTotal: number;
};
export type PlanningResult = {
  allocations: Allocation[];
  issues: { store: string; mspItemCode: string; reason: string }[];
  supplierTotals: { supplier: string; netItems: number; deliveryCharge: number; total: number }[];
};

function validOffer(offer: SupplierOffer) {
  return offer.available && Number.isFinite(offer.netCasePrice) && offer.netCasePrice >= 0 &&
    Number.isFinite(offer.unitsPerCase) && offer.unitsPerCase > 0;
}

/**
 * Draft-only allocation. Does not send orders.
 * Compares rounded case costs, then validates supplier-wide minimums.
 * Delivery charges are accounted for in totals but NOT globally optimized.
 * Suppliers with unmet minimums are excluded on subsequent passes.
 */
export function planSupplierOrders(requirements: Requirement[], offers: SupplierOffer[]): PlanningResult {
  const issues: PlanningResult["issues"] = [];
  const validRequirements = requirements.filter(r => {
    const ok = !!r.store.trim() && !!r.mspItemCode.trim() &&
      Number.isSafeInteger(r.requiredUnits) && r.requiredUnits > 0;
    if (!ok) issues.push({ store: r.store, mspItemCode: r.mspItemCode, reason: "Invalid required quantity or store" });
    return ok;
  });
  const grouped = new Map<string, Requirement>();
  for (const r of validRequirements) {
    const key = JSON.stringify([r.store, r.mspItemCode]);
    const existing = grouped.get(key);
    if (existing) existing.requiredUnits += r.requiredUnits;
    else grouped.set(key, { ...r });
  }
  const blocked = new Set<string>();
  let allocations: Allocation[] = [];
  let unresolved: PlanningResult["issues"] = [];
  for (let pass = 0; pass <= offers.length + 1; pass++) {
    allocations = [];
    unresolved = [];
    for (const r of grouped.values()) {
      const eligible = offers.filter(o => o.mspItemCode === r.mspItemCode && validOffer(o) && !blocked.has(o.supplier))
        .map(o => ({ offer: o, cases: Math.ceil(r.requiredUnits / o.unitsPerCase) }))
        .sort((a,b) => a.cases * a.offer.netCasePrice - b.cases * b.offer.netCasePrice ||
          a.offer.supplier.localeCompare(b.offer.supplier) || a.offer.supplierCode.localeCompare(b.offer.supplierCode));
      const selected = eligible[0];
      if (!selected) {
        unresolved.push({ store: r.store, mspItemCode: r.mspItemCode, reason: "No eligible mapped supplier price" });
        continue;
      }
      const o = selected.offer;
      allocations.push({
        store: r.store, mspItemCode: r.mspItemCode, supplier: o.supplier, supplierCode: o.supplierCode,
        cases: selected.cases, orderedUnits: selected.cases * o.unitsPerCase,
        unitCost: o.netCasePrice / o.unitsPerCase, lineTotal: selected.cases * o.netCasePrice
      });
    }
    const bySupplier = new Map<string, number>();
    for (const a of allocations) bySupplier.set(a.supplier, (bySupplier.get(a.supplier) || 0) + a.lineTotal);
    const newBlocked = new Set<string>();
    for (const [supplier, net] of bySupplier) {
      const min = Math.max(0, ...offers.filter(o => o.supplier === supplier).map(o => o.minimumOrderValue || 0));
      if (net < min) newBlocked.add(supplier);
    }
    if (!newBlocked.size) break;
    const previous = blocked.size;
    for (const s of newBlocked) blocked.add(s);
    if (blocked.size === previous) break;
  }
  const totals = new Map<string, { supplier: string; netItems: number; deliveryCharge: number; total: number }>();
  for (const a of allocations) {
    const current = totals.get(a.supplier) || { supplier: a.supplier, netItems: 0, deliveryCharge: 0, total: 0 };
    current.netItems += a.lineTotal;
    totals.set(a.supplier, current);
  }
  for (const t of totals.values()) {
    t.deliveryCharge = Math.max(0, ...offers.filter(o => o.supplier === t.supplier).map(o => o.deliveryCharge || 0));
    t.total = t.netItems + t.deliveryCharge;
  }
  return { allocations, issues: [...issues, ...unresolved], supplierTotals: [...totals.values()].sort((a,b)=>a.supplier.localeCompare(b.supplier)) };
}
