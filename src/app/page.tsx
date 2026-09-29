"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronRight, ClipboardList, LayoutDashboard, Package, Search, Settings, ShoppingCart, Store } from "lucide-react";

const suppliers = [
  { name: "Polish Village Bread", products: 28, accent: "PVB" },
  { name: "Starmalyn", products: 24, accent: "STM" },
  { name: "Polish Bakery", products: 26, accent: "PB" },
  { name: "P.J. Martin", products: 22, accent: "PJM" },
];

const products = [
  { code: "PVB-001", barcode: "5900010000011", name: "CHLEB WIEJSKI 500G", caseSize: 10 },
  { code: "PVB-002", barcode: "5900010000028", name: "CHLEB RAZOWY 400G", caseSize: 8 },
  { code: "PVB-003", barcode: "5900010000035", name: "CHLEB BALTONOWSKI 500G", caseSize: 12 },
  { code: "PVB-004", barcode: "5900010000042", name: "BAGIETKA 300G", caseSize: 12 },
];

export default function Home() {
  const [supplier, setSupplier] = useState(suppliers[0].name);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const filtered = useMemo(() => products.filter(p => (p.name + p.code + p.barcode).toLowerCase().includes(query.toLowerCase())), [query]);
  const totalCases = Object.values(qty).reduce((a,b)=>a+b,0);
  const totalUnits = products.reduce((sum,p)=>sum+(qty[p.code]||0)*p.caseSize,0);

  return <div className="shell">
    <aside>
      <div className="brand"><div className="mark">M</div><div><b>Mieszko</b><span>Office Operations</span></div></div>
      <nav>
        <a><LayoutDashboard size={19}/>Dashboard</a>
        <a className="active"><ShoppingCart size={19}/>Supplier Orders</a>
        <a><Package size={19}/>Products</a>
        <a><Building2 size={19}/>Suppliers</a>
        <a><Store size={19}/>Stores</a>
        <a><ClipboardList size={19}/>Order History</a>
      </nav>
      <div className="navBottom"><a><Settings size={19}/>Administration</a></div>
    </aside>

    <main>
      <header><div><p className="eyebrow">SUPPLIER ORDERS</p><h1>Create store order</h1><p className="muted">Choose a supplier and enter the number of cases required.</p></div><div className="storePill"><Store size={17}/><span>Hounslow</span></div></header>

      <section className="supplierGrid">
        {suppliers.map(s => <button key={s.name} onClick={()=>setSupplier(s.name)} className={supplier===s.name?"supplier selected":"supplier"}>
          <div className="supplierIcon">{s.accent}</div><div><b>{s.name}</b><span>{s.products} products</span></div><ChevronRight size={18}/>
        </button>)}
      </section>

      <section className="orderCard">
        <div className="orderTop"><div><span className="tag">ORDERING FROM</span><h2>{supplier}</h2></div><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product, item code or barcode"/></div></div>
        <div className="tableHead"><span>Product</span><span>Case size</span><span>Order cases</span><span>Total units</span></div>
        {filtered.map(p => {
          const n=qty[p.code]||0;
          return <div className="productRow" key={p.code}>
            <div className="product"><div className="productIcon"><Package size={19}/></div><div><b>{p.name}</b><span>{p.code} · {p.barcode}</span></div></div>
            <strong>{p.caseSize}</strong>
            <div className="stepper"><button onClick={()=>setQty({...qty,[p.code]:Math.max(0,n-1)})}>−</button><input type="number" min="0" value={n} onChange={e=>setQty({...qty,[p.code]:Math.max(0,Number(e.target.value))})}/><button onClick={()=>setQty({...qty,[p.code]:n+1})}>+</button></div>
            <strong>{n*p.caseSize}</strong>
          </div>
        })}
      </section>

      <div className="summary"><div><span>TOTAL ORDER</span><b>{totalCases} cases</b><small>{totalUnits} individual units</small></div><div className="actions"><button className="draft">Save draft</button><button className="submit">Review order <ChevronRight size={18}/></button></div></div>
    </main>
  </div>;
}
