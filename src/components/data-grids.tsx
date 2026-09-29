"use client";

import Link from "next/link";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { setProductActive, setStoreActive, setSupplierActive, setUserActive } from "@/server/actions/admin";

ModuleRegistry.registerModules([AllCommunityModule]);

type Row = Record<string, string | number | boolean | null | undefined>;

function ActionCell({ data }: { data?: Row }) {
  if (!data) return null;
  const action = data.actionType === "product" ? setProductActive : data.actionType === "store" ? setStoreActive : data.actionType === "supplier" ? setSupplierActive : data.actionType === "user" ? setUserActive : null;
  return <div className="gridActions">{data.editHref ? <Link className="gridEditLink" href={String(data.editHref)}>Edit</Link> : null}{action && data.id ? <form action={action}><input type="hidden" name="id" value={String(data.id)} /><input type="hidden" name="active" value={data.active ? "false" : "true"} /><button className="gridActionButton" type="submit">{data.active ? "Deactivate" : "Activate"}</button></form> : null}</div>;
}

function EditCell({ value }: { value?: string }) {
  return value ? <Link className="gridEditLink" href={value}>Edit</Link> : null;
}

export function MieszkoDataGrid({ rows, columns, height = 520 }: { rows: Row[]; columns: ColDef<Row>[]; height?: number }) {
  const defs: ColDef<Row>[] = columns.map((column) => column.field === "editHref" ? { ...column, headerName: "Actions", width: 165, sortable: false, filter: false, resizable: false, cellRenderer: ActionCell } : column);
  return (
    <div className="ag-theme-quartz mieszkoGrid" style={{ height }}>
      <AgGridReact<Row>
        theme="legacy"
        rowData={rows}
        columnDefs={defs}
        defaultColDef={{ sortable: true, filter: true, resizable: true, flex: 1, minWidth: 105 }}
        rowHeight={42}
        headerHeight={38}
        pagination={rows.length > 50}
        paginationPageSize={50}
        paginationPageSizeSelector={[25, 50, 100]}
        animateRows={false}
      />
    </div>
  );
}

export function ProductsGrid({ products, query }: { products: any[]; query: { q?: string; supplier?: string } }) {
  const rows = products.map(p => ({
    itemCode: p.itemCode || "—", ean: p.ean || "—", supplierCode: p.supplierCode || "—",
    name: p.name, polishName: p.polishName || "—", supplier: p.supplierName || "—",
    status: p.active ? "Active" : "Inactive",
    id:p.id, active:p.active, actionType:"product", editHref: `/admin/products?edit=${p.id}&q=${encodeURIComponent(query.q || "")}&supplier=${query.supplier || ""}`
  }));
  return <MieszkoDataGrid rows={rows} columns={[
    { field: "itemCode", headerName: "Item code" }, { field: "ean", headerName: "EAN", minWidth: 145 },
    { field: "supplierCode", headerName: "Supplier code" }, { field: "name", headerName: "English name", minWidth: 220, flex: 2 },
    { field: "polishName", headerName: "Polish name", minWidth: 180, flex: 1.5 }, { field: "supplier", headerName: "Supplier", minWidth: 160 },
    { field: "status", headerName: "Status", width: 100, flex: 0 }, { field: "editHref" }
  ]} height={Math.min(650, 80 + Math.max(rows.length, 5) * 42)} />;
}

export function ShopsGrid({ stores }: { stores: any[] }) {
  const rows = stores.map(s => ({ name:s.name, code:s.code || "—", email:s.email || "—", status:s.active ? "Active":"Inactive", id:s.id, active:s.active, actionType:"store", editHref:`/admin/stores?edit=${s.id}` }));
  return <MieszkoDataGrid rows={rows} columns={[
    {field:"name",headerName:"Shop",minWidth:180,flex:1.5},{field:"code",headerName:"Code",width:100,flex:0},{field:"email",headerName:"Shop email",minWidth:220,flex:2},{field:"status",headerName:"Status",width:100,flex:0},{field:"editHref"}
  ]} height={Math.min(520, 80 + Math.max(rows.length,5)*42)} />;
}

function SupplierMobileActions({ data }: { data?: Row }) {
  if (!data?.editHref) return null;
  return <Link className="gridEditLink" href={String(data.editHref)}>Edit</Link>;
}

export function SuppliersGrid({ suppliers }: { suppliers: any[] }) {
  const rows = suppliers.map(s => ({ name:s.name, email:s.orderEmail || "—", cc:(s.ccEmails || []).join(", ") || "—", status:s.active ? "Active":"Inactive", id:s.id, active:s.active, actionType:"supplier", editHref:`/admin/suppliers?edit=${s.id}` }));
  return <MieszkoDataGrid rows={rows} columns={[
    {field:"name",headerName:"Supplier",minWidth:160,flex:1.5},{field:"email",headerName:"Order email",minWidth:190,flex:2},{field:"cc",headerName:"CC emails",minWidth:180,flex:1.5},{field:"status",headerName:"Status",width:100,flex:0},{field:"editHref",headerName:"Edit",width:78,minWidth:78,maxWidth:78,pinned:"right",sortable:false,filter:false,resizable:false,cellRenderer:SupplierMobileActions}
  ]} height={Math.min(520, 80 + Math.max(rows.length,5)*42)} />;
}

export function UsersGrid({ users }: { users: any[] }) {
  const rows = users.map(u => ({ name:u.fullName, role:u.role, store:u.storeName || "—", status:u.active ? "Active":"Inactive", last:u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString("en-GB") : "—", id:u.userId, active:u.active, actionType:"user", editHref:`/admin/users?edit=${u.userId}` }));
  return <MieszkoDataGrid rows={rows} columns={[
    {field:"name",headerName:"Name",minWidth:180,flex:1.5},{field:"role",headerName:"Role"},{field:"store",headerName:"Shop",minWidth:140},{field:"status",headerName:"Status",width:100,flex:0},{field:"last",headerName:"Last activity",minWidth:160},{field:"editHref"}
  ]} height={Math.min(560, 80 + Math.max(rows.length,5)*42)} />;
}


export function OrdersGrid({ orders, hrefBase, mode }: { orders: any[]; hrefBase: string; mode: "shop" | "office" }) {
  const rows = orders.map(o => ({
    shop:o.storeName || "—", supplier:o.supplierName, orderDate:o.orderDate, deliveryDate:o.deliveryDate,
    products:o.products, qty:o.totalQty, email:o.emailStatus, sentBy:o.sentBy || (o.status === "draft" ? "—" : "Unknown"),
    status:o.status, editHref:`${hrefBase}/${o.id}`
  }));
  const columns: ColDef<Row>[] = [
    ...(mode === "office" ? [{field:"shop",headerName:"Shop",minWidth:140} as ColDef<Row>] : []),
    {field:"supplier",headerName:"Supplier",minWidth:170,flex:1.5},{field:"orderDate",headerName:"Order date",minWidth:120},
    {field:"deliveryDate",headerName:"Delivery date",minWidth:120},{field:"products",headerName:"Products",width:95,flex:0},
    {field:"qty",headerName:"Qty",width:80,flex:0},{field:"email",headerName:"Email",minWidth:110},
    {field:"sentBy",headerName:"Sent by",minWidth:130},{field:"status",headerName:"Status",width:105,flex:0},{field:"editHref"}
  ];
  return <MieszkoDataGrid rows={rows} columns={columns} height={Math.min(650, 80 + Math.max(rows.length,6)*42)} />;
}
