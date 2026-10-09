"use client";
import { useMemo, useState } from "react";
import { planSupplierOrders, type SupplierOffer, type Requirement } from "@/lib/smart-order-planner";

type Mapping = { supplier: string; supplierCode: string; mspItemCode: string; description: string; barcode: string };
const suppliers = ["Spizarnia", "Mastermedia", "Wabar"];
const demoMappings: Mapping[] = [
 { supplier:"Spizarnia", supplierCode:"SP-1005", mspItemCode:"12345", description:"Sample dairy 500g", barcode:"5901234567890" },
 { supplier:"Mastermedia", supplierCode:"MM-7821", mspItemCode:"12345", description:"Sample dairy 500g", barcode:"5901234567891" },
 { supplier:"Wabar", supplierCode:"WB-4450", mspItemCode:"12345", description:"Sample dairy 500g", barcode:"5901234567890" },
 { supplier:"Spizarnia", supplierCode:"SP-1006", mspItemCode:"23456", description:"Sample biscuits 250g", barcode:"5901234567005" },
 { supplier:"Wabar", supplierCode:"WB-4451", mspItemCode:"23456", description:"Sample biscuits 250g", barcode:"5901234567005" }
];
const demoOffers: SupplierOffer[] = [
 {supplier:"Spizarnia",supplierCode:"SP-1005",mspItemCode:"12345",netCasePrice:16.2,unitsPerCase:12,available:true},
 {supplier:"Mastermedia",supplierCode:"MM-7821",mspItemCode:"12345",netCasePrice:14.64,unitsPerCase:12,available:true},
 {supplier:"Wabar",supplierCode:"WB-4450",mspItemCode:"12345",netCasePrice:15.48,unitsPerCase:12,available:true},
 {supplier:"Spizarnia",supplierCode:"SP-1006",mspItemCode:"23456",netCasePrice:8,unitsPerCase:10,available:true},
 {supplier:"Wabar",supplierCode:"WB-4451",mspItemCode:"23456",netCasePrice:7.5,unitsPerCase:10,available:true}
];
const money=(n:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(n);
function parseCsv(source:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<source.length;i++){const c=source[i];
  if(c==='"'&&quoted&&source[i+1]==='"'){cell+='"';i++}
  else if(c==='"')quoted=!quoted;
  else if(c===","&&!quoted){row.push(cell);cell=""}
  else if((c==="\r"||c==="\n")&&!quoted){if(c==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=""}
  else cell+=c;
 }
 if(quoted)throw Error("CSV contains an unmatched quote");
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
function parsePriceRows(rows:string[][],supplier:string,mappings:Mapping[]) {
 const headers=(rows.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,"").toLowerCase().replace(/\s+/g,"_"));
 const idx=["supplier_code","net_case_price","units_per_case"].map(k=>headers.indexOf(k));
 if(idx.some(i=>i<0))throw Error("Required columns: supplier_code, net_case_price, units_per_case");
 const pending:SupplierOffer[]=[],issues:string[]=[];
 rows.forEach((row,i)=>{const code=(row[idx[0]]||"").trim(),rawPrice=(row[idx[1]]||"").trim(),rawCase=(row[idx[2]]||"").trim(),price=Number(rawPrice),units=Number(rawCase);
  const mapping=mappings.find(m=>m.supplier===supplier&&m.supplierCode===code);
  if(!mapping){issues.push("Row "+(i+2)+": supplier code "+code+" is not mapped");return}
  if(!rawPrice||!rawCase||!Number.isFinite(price)||price<0||!Number.isSafeInteger(units)||units<=0){issues.push("Row "+(i+2)+": invalid case price or pack size");return}
  if(pending.some(p=>p.supplierCode===code)){issues.push("Row "+(i+2)+": duplicate supplier code "+code);return}
  pending.push({supplier,supplierCode:code,mspItemCode:mapping.mspItemCode,netCasePrice:price,unitsPerCase:units,available:true});
 });
 return {pending,issues};
}
export default function SmartOrderingWorkspace(){
 const [tab,setTab]=useState<"planning"|"prices"|"mapping"|"orders">("planning");
 const [mappings,setMappings]=useState<Mapping[]>(demoMappings);
 const [offers,setOffers]=useState<SupplierOffer[]>(demoOffers);
 const [requirements,setRequirements]=useState<Requirement[]>([{store:"Hounslow",mspItemCode:"12345",requiredUnits:24},{store:"Hounslow",mspItemCode:"23456",requiredUnits:18}]);
 const [store,setStore]=useState("Hounslow"),[code,setCode]=useState("12345"),[qty,setQty]=useState("24");
 const [supplier,setSupplier]=useState("Spizarnia");
 const [pending,setPending]=useState<SupplierOffer[]>([]),[issues,setIssues]=useState<string[]>([]);
 const [draft,setDraft]=useState<ReturnType<typeof planSupplierOrders>|null>(null);
 const [form,setForm]=useState<Mapping>({supplier:"Spizarnia",supplierCode:"",mspItemCode:"",description:"",barcode:""});
 const products=useMemo(()=>[...new Map(mappings.map(m=>[m.mspItemCode,{code:m.mspItemCode,description:m.description}])).values()], [mappings]);
 const comparison=useMemo(()=>planSupplierOrders(requirements,offers),[requirements,offers]);
 const buttonStyle={border:"1px solid #d7deed",borderRadius:9,padding:"10px 15px",background:"white",cursor:"pointer"} as const;
 const primary={...buttonStyle,background:"#5143d5",color:"white",borderColor:"#5143d5"} as const;
 const field={padding:"10px 12px",border:"1px solid #d7deed",borderRadius:9,minWidth:125} as const;
 const card={background:"white",padding:20,border:"1px solid #e2e7f1",borderRadius:14,marginBottom:16} as const;
 const th={padding:12,textAlign:"left" as const,background:"#f5f7fc",fontSize:12,color:"#53617b"};
 const td={padding:12,borderBottom:"1px solid #eef1f6",fontSize:13};
 const table=(headers:string[],rows:React.ReactNode[][])=><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",whiteSpace:"nowrap"}}><thead><tr>{headers.map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={td}>{c}</td>)}</tr>)}</tbody></table></div>;
 async function upload(file:File|null){if(!file)return;setIssues([]);setPending([]);
  try{let rows:string[][];
   if(file.name.toLowerCase().endsWith(".csv"))rows=parseCsv(await file.text());
   else if(file.name.toLowerCase().endsWith(".xlsx")){
    const ExcelJS=(await import("exceljs")).default;const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer() as never);
    const sheet=workbook.worksheets[0];if(!sheet)throw Error("Workbook has no sheets");
    rows=[];sheet.eachRow(row=>{rows.push((row.values as unknown[]).slice(1).map(v=>typeof v==="object"&&v!==null&&"text" in v?String(v.text):String(v??"")))});
   }else throw Error("Upload CSV or XLSX only");
   const parsed=parsePriceRows(rows,supplier,mappings);setPending(parsed.pending);setIssues(parsed.issues);
  }catch(e){setIssues([e instanceof Error?e.message:"Could not read file"])}
 }
 function saveMapping(){const next={...form,supplierCode:form.supplierCode.trim(),mspItemCode:form.mspItemCode.trim(),barcode:form.barcode.trim()};
  if(!next.supplierCode||!next.mspItemCode||!next.description.trim()){setIssues(["Supplier code, MSP code and description are required"]);return}
  const clash=mappings.find(m=>m.supplier===next.supplier&&m.supplierCode===next.supplierCode&&m.mspItemCode!==next.mspItemCode);
  if(clash){setIssues(["Supplier code already maps to another MSP product"]);return}
  const barcodeClash=mappings.find(m=>next.barcode&&m.barcode===next.barcode&&m.mspItemCode!==next.mspItemCode);
  if(barcodeClash){setIssues(["Barcode is already linked to another MSP product"]);return}
  setMappings(old=>[...old.filter(m=>!(m.supplier===next.supplier&&m.supplierCode===next.supplierCode)),next]);setIssues([]);setForm({...form,supplierCode:"",barcode:""});
 }
 function csvExport(){if(!draft?.allocations.length)return;const cols=["store","supplier","mspItemCode","supplierCode","cases","orderedUnits","unitCost","lineTotal"] as const;
  const quote=(v:unknown)=>'"'+String(v).replace(/"/g,'""')+'"';
  const csv=[cols.join(","),...draft.allocations.map(a=>cols.map(k=>quote(a[k])).join(","))].join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download="mieszko-supplier-draft.csv";a.click();URL.revokeObjectURL(url);
 }
 return <div style={{fontFamily:"inherit",color:"#17223b"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:16}}><div><h1 style={{margin:0}}>Smart Supplier Ordering</h1><p style={{color:"#64748b",margin:"6px 0"}}>Compare supplier prices and split store orders automatically.</p></div><span style={{background:"#fff3d6",padding:"8px 12px",borderRadius:30,fontSize:12}}>Prototype · Sample data · Not saved</span></div>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>{(["planning","prices","mapping","orders"] as const).map(t=><button key={t} onClick={()=>setTab(t)} style={tab===t?primary:buttonStyle}>{({planning:"Order Planning",prices:"Supplier Prices",mapping:"Product Mapping",orders:"Draft Orders"})[t]}</button>)}</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:20}}>
  {[["Products",products.length],["Mapped supplier codes",mappings.length],["Approved offers",offers.length],["Estimated draft",money(comparison.supplierTotals.reduce((s,t)=>s+t.total,0))]].map(([label,value])=><div key={label} style={card}><div style={{color:"#64748b",fontSize:13}}>{label}</div><div style={{fontSize:26,fontWeight:750,marginTop:8}}>{value}</div></div>)}</div>
  {tab==="planning"&&<><div style={card}><h2>Store requirements</h2><div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}><label>Store<br/><select style={field} value={store} onChange={e=>setStore(e.target.value)}>{["Hounslow","Perivale","East Ham","Hayes","Gravesend","Watford","Streatham","Other"].map(s=><option key={s}>{s}</option>)}</select></label><label>Product<br/><select style={field} value={code} onChange={e=>setCode(e.target.value)}>{products.map(p=><option key={p.code} value={p.code}>{p.code} — {p.description}</option>)}</select></label><label>Required units<br/><input style={field} type="number" min="1" step="1" value={qty} onChange={e=>setQty(e.target.value)}/></label><button style={primary} onClick={()=>{const n=Number(qty);if(!Number.isSafeInteger(n)||n<=0)return;setRequirements(old=>[...old,{store,mspItemCode:code,requiredUnits:n}]);setDraft(null)}}>Add requirement</button></div></div>
  <div style={card}><h2>Supplier price comparison</h2>{table(["Store","MSP Code","Product","Required","Best supplier","Cases","Net line total"],requirements.map(r=>{const result=planSupplierOrders([r],offers);const a=result.allocations[0];return [r.store,r.mspItemCode,products.find(p=>p.code===r.mspItemCode)?.description||"—",r.requiredUnits,a?.supplier||"Needs mapping",a?.cases??"—",a?money(a.lineTotal):"—"]}))}<div style={{marginTop:16}}><button style={primary} onClick={()=>{setDraft(comparison);setTab("orders")}}>Generate supplier draft orders</button></div></div></>}
  {tab==="prices"&&<><div style={card}><h2>Supplier price upload</h2><p>CSV or XLSX columns: <code>supplier_code, net_case_price, units_per_case</code>. Net price must be per case.</p><div style={{display:"flex",gap:12,flexWrap:"wrap"}}><select style={field} value={supplier} onChange={e=>{setSupplier(e.target.value);setPending([]);setIssues([])}}>{suppliers.map(s=><option key={s}>{s}</option>)}</select><input style={field} type="file" accept=".csv,.xlsx" onChange={e=>void upload(e.target.files?.[0]||null)}/></div>{issues.length>0&&<div style={{background:"#fff1e9",padding:12,marginTop:12,borderRadius:9}}>{issues.map((x,i)=><p key={i} style={{margin:4}}>{x}</p>)}</div>}{pending.length>0&&<div style={{marginTop:16}}><h3>Price preview ({pending.length} mapped lines)</h3>{table(["Supplier code","MSP Code","Case size","Net case price"],pending.map(p=>[p.supplierCode,p.mspItemCode,p.unitsPerCase,money(p.netCasePrice)]))}<button style={primary} disabled={issues.length>0} onClick={()=>{setOffers(old=>[...old.filter(o=>!pending.some(p=>p.supplier===o.supplier&&p.supplierCode===o.supplierCode)),...pending]);setPending([]);setDraft(null)}}>Approve preview prices</button></div>}</div><div style={card}><h2>Approved offers</h2>{table(["Supplier","Supplier code","MSP Code","Case size","Net case","Net unit"],offers.map(o=>[o.supplier,o.supplierCode,o.mspItemCode,o.unitsPerCase,money(o.netCasePrice),money(o.netCasePrice/o.unitsPerCase)]))}</div></>}
  {tab==="mapping"&&<><div style={card}><h2>Supplier code → MSP product mapping</h2><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{(["supplier","supplierCode","mspItemCode","description","barcode"] as const).map(k=><label key={k} style={{fontSize:13}}>{k}<br/>{k==="supplier"?<select style={field} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}>{suppliers.map(s=><option key={s}>{s}</option>)}</select>:<input style={field} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>}</label>)}<button style={primary} onClick={saveMapping}>Save mapping</button></div>{issues.map((x,i)=><p key={i} style={{color:"#b45309"}}>{x}</p>)}</div><div style={card}>{table(["MSP Code","Product","Barcode","Supplier","Supplier code"],mappings.map(m=>[m.mspItemCode,m.description,m.barcode,m.supplier,m.supplierCode]))}</div></>}
  {tab==="orders"&&<div style={card}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><h2>Draft supplier orders</h2><button style={primary} onClick={csvExport} disabled={!draft?.allocations.length}>Export CSV</button></div><p>Drafts only — no supplier emails or database writes.</p>{!draft?<p>Generate drafts from Order Planning first.</p>:<>{draft.issues.map((issue,i)=><p key={i} style={{color:"#b45309"}}>{issue.mspItemCode}: {issue.reason}</p>)}{draft.supplierTotals.map(t=><div key={t.supplier} style={{marginTop:18}}><h3>{t.supplier} — {money(t.total)}</h3>{table(["Store","MSP Code","Supplier code","Cases","Units","Net total"],draft.allocations.filter(a=>a.supplier===t.supplier).map(a=>[a.store,a.mspItemCode,a.supplierCode,a.cases,a.orderedUnits,money(a.lineTotal)]))}</div>)}</>}</div>}
  <p style={{color:"#9a6a00",fontSize:12}}>Development preview: changes are held in memory and reset on refresh. Local PostgreSQL, authentication for import actions, supplier availability, minimum-order configuration and full delivery-cost optimisation are not yet connected.</p>
 </div>;
}
