"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AllCommunityModule, ModuleRegistry, type ColDef, type CellValueChangedEvent, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { productMatches, summarize } from "@/lib/order-rules";
import { saveOrderLine } from "@/server/actions/shop";

ModuleRegistry.registerModules([AllCommunityModule]);

export type EditorProduct = {
  id: string; name: string; polishName: string | null; itemCode: string | null;
  ean: string | null; supplierCode: string | null; quantity: number;
};

type GridProduct = EditorProduct & { qty: number; showPolish: boolean };

function ProductNameCell({ data }: ICellRendererParams<GridProduct>) {
  if (!data) return null;
  return <div className="orderProductCell"><b>{data.name}</b>{data.showPolish && data.polishName ? <span>{data.polishName}</span> : null}</div>;
}

export function OrderEditor({ orderId, products }: { orderId: string; products: EditorProduct[] }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(products.map(p => [p.id, p.quantity])));
  const [search, setSearch] = useState("");
  const [orderedOnly, setOrderedOnly] = useState(false);
  const [showPolish, setShowPolish] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef<Promise<void>>(Promise.resolve());

  function update(productId: string, next: number) {
    const quantity = Number.isInteger(next) && next > 0 ? next : 0;
    setQuantities(current => ({ ...current, [productId]: quantity }));
    const run = async () => {
      const result = await saveOrderLine(orderId, productId, quantity);
      if (result && "error" in result && result.error) setError(result.error); else setError("");
    };
    pending.current = pending.current.then(run, run);
  }

  const rows = useMemo<GridProduct[]>(() => products
    .filter(product => {
      const quantity = quantities[product.id] || 0;
      if (orderedOnly && quantity <= 0) return false;
      return productMatches(product, search);
    })
    .map(product => ({
      ...product,
      qty: quantities[product.id] || 0,
      showPolish
    })), [orderedOnly, products, quantities, search, showPolish]);

  const columns = useMemo<ColDef<GridProduct>[]>(() => [
    { field:"itemCode", headerName:"Item code", minWidth:110 },
    { field:"ean", headerName:"EAN", minWidth:150 },
    { field:"supplierCode", headerName:"Supplier code", minWidth:125 },
    { field:"name", headerName:"Product name", minWidth:340, flex:2.4, cellRenderer: ProductNameCell },
    { field:"qty", headerName:"Qty", width:110, minWidth:110, maxWidth:110, flex:0, pinned:"right", editable:true, cellClass:"agQtyCell",
      valueParser: p => { const n=Number(p.newValue); return Number.isInteger(n) && n > 0 ? n : 0; } }
  ], []);

  const totals = summarize(products.map(product => ({ quantity: quantities[product.id] || 0 })));

  function changed(event: CellValueChangedEvent<GridProduct>) {
    if (event.colDef.field === "qty" && event.data) update(event.data.id, Number(event.newValue));
  }

  return (
    <div className="orderEditor">
      <div className="toolbar">
        <label className="searchLabel"><span className="srOnly">Search products</span>
          <input className="searchInput" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." />
        </label>
        <div className="segmented" role="group" aria-label="Product filter">
          <button type="button" className={!orderedOnly ? "on" : undefined} onClick={() => setOrderedOnly(false)}>All products</button>
          <button type="button" className={orderedOnly ? "on" : undefined} onClick={() => setOrderedOnly(true)}>Ordered only</button>
          <button type="button" className={showPolish ? "on" : undefined} onClick={() => setShowPolish(v => !v)}>{showPolish ? "Polish names: On" : "Polish names: Off"}</button>
        </div>
      </div>
      {error && <div className="banner error" role="alert">{error}</div>}
      {products.length === 0 ? <div className="emptyState"><h2>No products yet</h2><p>No products have been assigned to this supplier yet.</p></div> :
       rows.length === 0 ? <div className="emptyState"><h2>No matches</h2><p>{orderedOnly ? "No products have a quantity yet." : "No products match your search."}</p></div> :
       <div className="ag-theme-quartz mieszkoGrid orderAgGrid" style={{height:Math.min(650, Math.max(300, 80 + rows.length * 42))}}>
         <AgGridReact<GridProduct> rowData={rows} columnDefs={columns}
           defaultColDef={{sortable:true,filter:true,resizable:true,flex:1,minWidth:100}}
           rowHeight={50} headerHeight={40} animateRows={false} onCellValueChanged={changed}
           ensureDomOrder stopEditingWhenCellsLoseFocus />
       </div>}
      <div className="orderBar">
        <div><b>{totals.products} products selected</b><span>Total qty: {totals.quantity}</span></div>
        <button type="button" className="button primary" onClick={async () => { await pending.current; router.push(`/shop/order/${orderId}/review`); }}>Review order</button>
      </div>
    </div>
  );
}
