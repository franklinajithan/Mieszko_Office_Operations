export type ConsolidationLine = {
  productId: string;
  productName: string;
  itemCode: string | null;
  barcode: string | null;
  caseSize: number;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  cases: number;
};

export type ConsolidationStore = {
  id: string;
  name: string;
  code: string | null;
};

export type ConsolidationRow = {
  productId: string;
  productName: string;
  itemCode: string | null;
  barcode: string | null;
  caseSize: number;
  byStore: Record<string, number>;
  totalCases: number;
  totalUnits: number;
};

export function storeColumnLabel(store: ConsolidationStore) {
  return store.code ? `${store.name} (${store.code})` : store.name;
}

export function consolidate(lines: ConsolidationLine[]) {
  const stores = new Map<string, ConsolidationStore>();
  const products = new Map<string, {
    productId: string;
    productName: string;
    itemCode: string | null;
    barcode: string | null;
    caseSize: number;
    byStore: Record<string, number>;
    totalCases: number;
    totalUnits: number;
    caseSizes: Map<number, number>;
  }>();

  for (const line of lines) {
    if (line.cases <= 0) continue;
    stores.set(line.storeId, { id: line.storeId, name: line.storeName, code: line.storeCode });
    let row = products.get(line.productId);
    if (!row) {
      row = {
        productId: line.productId,
        productName: line.productName,
        itemCode: line.itemCode,
        barcode: line.barcode,
        caseSize: line.caseSize,
        byStore: {},
        totalCases: 0,
        totalUnits: 0,
        caseSizes: new Map(),
      };
      products.set(line.productId, row);
    }
    row.byStore[line.storeId] = (row.byStore[line.storeId] || 0) + line.cases;
    row.totalCases += line.cases;
    row.totalUnits += line.caseSize * line.cases;
    row.caseSizes.set(line.caseSize, (row.caseSizes.get(line.caseSize) || 0) + line.cases);
  }

  const storeList = [...stores.values()].sort((a, b) => {
    const codeA = a.code ?? "zzz";
    const codeB = b.code ?? "zzz";
    if (codeA !== codeB) return codeA.localeCompare(codeB, "en-GB");
    return a.name.localeCompare(b.name, "en-GB");
  });

  const rows: ConsolidationRow[] = [...products.values()]
    .map((row) => {
      let caseSize = row.caseSize;
      let best = -1;
      for (const [size, count] of row.caseSizes) {
        if (count > best) {
          caseSize = size;
          best = count;
        }
      }
      return {
        productId: row.productId,
        productName: row.productName,
        itemCode: row.itemCode,
        barcode: row.barcode,
        caseSize,
        byStore: row.byStore,
        totalCases: row.totalCases,
        totalUnits: row.totalUnits,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "en-GB"));

  return { stores: storeList, rows };
}
