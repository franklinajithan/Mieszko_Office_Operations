"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { productMatches, summarize } from "@/lib/order-rules";
import { saveOrderLine } from "@/server/actions/shop";

export type EditorProduct = {
  id: string;
  name: string;
  polishName: string | null;
  itemCode: string | null;
  ean: string | null;
  supplierCode: string | null;
  quantity: number;
};

export function OrderEditor({ orderId, products }: { orderId: string; products: EditorProduct[] }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(products.map((product) => [product.id, product.quantity])));
  const [search, setSearch] = useState("");
  const [orderedOnly, setOrderedOnly] = useState(false);
  const [showPolish, setShowPolish] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef<Promise<void>>(Promise.resolve());

  function update(productId: string, next: number) {
    const quantity = Number.isInteger(next) && next > 0 ? next : 0;
    setQuantities((current) => ({ ...current, [productId]: quantity }));
    const run = async () => {
      const result = await saveOrderLine(orderId, productId, quantity);
      if (result && "error" in result && result.error) setError(result.error);
      else setError("");
    };
    pending.current = pending.current.then(run, run);
  }

  const shown = useMemo(() => products.filter((product) => {
    const quantity = quantities[product.id] || 0;
    if (orderedOnly && quantity <= 0) return false;
    return productMatches(product, search);
  }), [orderedOnly, products, quantities, search]);

  const totals = summarize(products.map((product) => ({ quantity: quantities[product.id] || 0 })));

  return (
    <>
      <div className="toolbar">
        <label className="searchLabel">
          <span className="srOnly">Search products</span>
          <input className="searchInput" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." />
        </label>
        <div className="segmented" role="group" aria-label="Product filter">
          <button type="button" className={!orderedOnly ? "on" : undefined} onClick={() => setOrderedOnly(false)}>All products</button>
          <button type="button" className={orderedOnly ? "on" : undefined} onClick={() => setOrderedOnly(true)}>Ordered only</button>
          <button type="button" className={showPolish ? "on" : undefined} onClick={() => setShowPolish((value) => !value)}>{showPolish ? "Polish names: On" : "Polish names: Off"}</button>
        </div>
      </div>
      {error && <div className="banner error" role="alert">{error}</div>}
      {products.length === 0 ? (
        <div className="emptyState"><h2>No products yet</h2><p>No products have been assigned to this supplier yet.</p></div>
      ) : shown.length === 0 ? (
        <div className="emptyState"><h2>No matches</h2><p>{orderedOnly ? "No products have a quantity yet." : "No products match your search."}</p></div>
      ) : (
        <div className="tableWrap orderSheet">
          <table className="data orderTable">
            <thead>
              <tr>
                <th>Item code</th>
                <th>EAN</th>
                <th>Supplier code</th>
                <th>Product name</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((product) => {
                const quantity = quantities[product.id] || 0;
                return (
                  <tr key={product.id}>
                    <td data-label="Item code">{product.itemCode || "—"}</td>
                    <td data-label="EAN">{product.ean || "—"}</td>
                    <td data-label="Supplier code">{product.supplierCode || "—"}</td>
                    <td data-label="Product name" className="productName"><b>{product.name}</b>{showPolish && product.polishName && <><br /><span className="muted">{product.polishName}</span></>}</td>
                    <td data-label="Qty">
                      <input
                        className="qtyInput"
                        aria-label={`Quantity for ${product.name}`}
                        inputMode="numeric"
                        value={quantity}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (raw === "" || /^\d+$/.test(raw)) update(product.id, raw === "" ? 0 : Number(raw));
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="orderBar">
        <div>
          <b>{totals.products} products selected</b>
          <span>Total qty: {totals.quantity}</span>
        </div>
        <button type="button" className="button primary" onClick={async () => { await pending.current; router.push(`/shop/order/${orderId}/review`); }}>Review order</button>
      </div>
    </>
  );
}
