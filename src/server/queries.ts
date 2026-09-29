import "server-only";
import { emailList } from "@/lib/emails";
import { londonToday } from "@/lib/format";
import { summarize } from "@/lib/order-rules";
import { db } from "./db";
import { isMissingRelation, logServerError } from "./errors";

export type SupplierCard = { id: string; name: string };
export type ProductRow = {
  id: string;
  name: string;
  polishName: string | null;
  itemCode: string | null;
  ean: string | null;
  supplierCode: string | null;
  supplierId: string;
  supplierName: string | null;
  active: boolean;
  sortOrder: number;
};
export type OrderLine = {
  id: string | null;
  productId: string;
  name: string;
  itemCode: string | null;
  ean: string | null;
  supplierCode: string | null;
  quantity: number;
};
export type OrderDetail = {
  id: string;
  storeId: string;
  supplierId: string;
  storeName: string;
  storeCode: string | null;
  storeEmail: string | null;
  supplierName: string;
  supplierEmail: string | null;
  supplierCc: string[];
  orderDate: string;
  deliveryDate: string | null;
  status: string;
  emailStatus: string | null;
  submittedAt: string | null;
  createdAt: string | null;
  lines: OrderLine[];
  products: number;
  totalQty: number;
};
export type OrderListItem = {
  id: string;
  orderDate: string;
  deliveryDate: string | null;
  status: string;
  emailStatus: string | null;
  submittedAt: string | null;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  supplierId: string;
  supplierName: string;
  products: number;
  totalQty: number;
};
export type StoreRow = { id: string; name: string; code: string | null; email: string | null; active: boolean };
export type SupplierRow = {
  id: string;
  name: string;
  active: boolean;
  orderEmail: string | null;
  ccEmails: string[];
  emailEnabled: boolean;
  emailSubjectTemplate: string | null;
};
export type UserRow = {
  userId: string;
  fullName: string;
  role: string;
  storeId: string | null;
  storeName: string | null;
  storeCode: string | null;
  active: boolean;
  pinEnabled: boolean;
  lastSeenAt: string | null;
};
export type AssignmentRow = {
  id: string;
  storeId: string;
  supplierId: string;
  active: boolean;
  orderDeadline: string | null;
};
export type AuditRow = {
  id: string;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};
export type OrderSettings = { deadline: string; enforce: boolean; note: string };

type Embedded<T> = T | T[] | null;

function one<T>(value: Embedded<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export async function listActiveSuppliers() {
  const { data, error } = await db().from("suppliers").select("id, name").eq("active", true).order("name");
  if (error) {
    logServerError("suppliers", error.message);
    return [] as SupplierCard[];
  }
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }));
}

export async function listStoreSuppliers(storeId: string) {
  const configured = await db().from("store_suppliers").select("id").eq("store_id", storeId).limit(1);
  if (configured.error) {
    if (!isMissingRelation(configured.error)) logServerError("store suppliers", configured.error.message);
    return listActiveSuppliers();
  }
  if (!configured.data?.length) return listActiveSuppliers();
  const assigned = await db()
    .from("store_suppliers")
    .select("supplier_id, suppliers!inner(id, name, active)")
    .eq("store_id", storeId)
    .eq("active", true);
  if (assigned.error) {
    logServerError("store suppliers", assigned.error.message);
    return listActiveSuppliers();
  }
  return (assigned.data ?? [])
    .map((row) => {
      const supplier = one(row.suppliers as Embedded<{ id: string; name: string; active: boolean }>);
      if (!supplier?.active) return null;
      return { id: String(supplier.id), name: String(supplier.name) };
    })
    .filter((row): row is SupplierCard => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
}

export async function supplierAllowedForStore(storeId: string, supplierId: string) {
  const suppliers = await listStoreSuppliers(storeId);
  return suppliers.some((supplier) => supplier.id === supplierId);
}

export async function getSupplier(id: string) {
  const { data, error } = await db().from("suppliers").select("id, name, active, order_email, cc_emails, email_enabled, email_subject_template").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapSupplier(data);
}

function mapSupplier(row: Record<string, unknown>): SupplierRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    active: row.active !== false,
    orderEmail: text(row.order_email),
    ccEmails: emailList(row.cc_emails),
    emailEnabled: row.email_enabled === true,
    emailSubjectTemplate: text(row.email_subject_template),
  };
}

export async function listSuppliers() {
  const { data, error } = await db().from("suppliers").select("id, name, active, order_email, cc_emails, email_enabled, email_subject_template").order("name");
  if (error) {
    logServerError("supplier list", error.message);
    return [] as SupplierRow[];
  }
  return (data ?? []).map((row) => mapSupplier(row as Record<string, unknown>));
}

function mapProduct(row: Record<string, unknown>): ProductRow {
  const supplier = one(row.suppliers as Embedded<{ name?: string }>);
  return {
    id: String(row.id),
    name: String(row.name ?? row.product_name ?? ""),
    polishName: text(row.polish_name),
    itemCode: text(row.item_code),
    ean: text(row.ean) || text(row.barcode),
    supplierCode: text(row.supplier_code) || text(row.supplier_product_code),
    supplierId: String(row.supplier_id ?? ""),
    supplierName: supplier?.name ?? null,
    active: row.active !== false,
    sortOrder: numberValue(row.sort_order),
  };
}

export async function listSupplierProducts(supplierId: string) {
  const { data, error } = await db()
    .from("products")
    .select("id, name, polish_name, item_code, barcode, ean, supplier_code, supplier_product_code, supplier_id, active, sort_order")
    .eq("supplier_id", supplierId)
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) {
    const fallback = await db()
      .from("products")
      .select("id, name, item_code, barcode, supplier_product_code, supplier_id, active, sort_order")
      .eq("supplier_id", supplierId)
      .eq("active", true)
      .order("name");
    if (fallback.error) {
      logServerError("products", fallback.error.message);
      return [] as ProductRow[];
    }
    return (fallback.data ?? []).map((row) => mapProduct(row as Record<string, unknown>));
  }
  return (data ?? []).map((row) => mapProduct(row as Record<string, unknown>));
}

export async function listProducts(filters: { search?: string; supplierId?: string } = {}) {
  let query = db()
    .from("products")
    .select("id, name, polish_name, item_code, barcode, ean, supplier_code, supplier_product_code, supplier_id, active, sort_order, suppliers(name)")
    .order("name");
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  const { data, error } = await query;
  if (error) {
    const fallback = await db().from("products").select("id, name, item_code, barcode, supplier_product_code, supplier_id, active, sort_order, suppliers(name)").order("name");
    if (fallback.error) {
      logServerError("product admin", fallback.error.message);
      return [] as ProductRow[];
    }
    return filterProducts((fallback.data ?? []).map((row) => mapProduct(row as Record<string, unknown>)), filters.search);
  }
  return filterProducts((data ?? []).map((row) => mapProduct(row as Record<string, unknown>)), filters.search);
}

function filterProducts(products: ProductRow[], search?: string) {
  const term = search?.trim().toLowerCase();
  if (!term) return products;
  return products.filter((product) => [product.name, product.polishName, product.itemCode, product.ean, product.supplierCode]
    .some((value) => value?.toLowerCase().includes(term)));
}

export async function getProduct(id: string) {
  const primary = await db().from("products").select("id, name, item_code, barcode, ean, supplier_code, supplier_product_code, supplier_id, active").eq("id", id).maybeSingle();
  const chosen = primary.error
    ? await db().from("products").select("id, name, item_code, barcode, supplier_product_code, supplier_id, active").eq("id", id).maybeSingle()
    : primary;
  if (chosen.error || !chosen.data) return null;
  return mapProduct(chosen.data as Record<string, unknown>);
}

const ORDER_SELECT = "id, order_date, delivery_date, status, email_status, submitted_at, created_at, store_id, supplier_id, stores(name, code, email), suppliers(name, order_email, cc_emails), order_items(id, cases, quantity, item_code_snapshot, ean_snapshot, supplier_code_snapshot, product_name_snapshot, product_id, products(name, item_code, barcode, ean, supplier_code, supplier_product_code))";
const ORDER_SELECT_BASIC = "id, order_date, status, submitted_at, created_at, store_id, supplier_id, stores(name, code), suppliers(name, order_email), order_items(id, cases, product_id, products(name, item_code, barcode, supplier_product_code))";

function mapOrder(row: Record<string, unknown>): OrderDetail | null {
  const store = one(row.stores as Embedded<{ name?: string; code?: string | null; email?: string | null }>);
  const supplier = one(row.suppliers as Embedded<{ name?: string; order_email?: string | null; cc_emails?: unknown }>);
  const items = (Array.isArray(row.order_items) ? row.order_items : []) as Record<string, unknown>[];
  const lines = items.map((item) => {
    const product = one(item.products as Embedded<{ name?: string; item_code?: string | null; barcode?: string | null; ean?: string | null; supplier_code?: string | null; supplier_product_code?: string | null }>);
    const quantity = numberValue(item.quantity ?? item.cases);
    return {
      id: text(item.id),
      productId: String(item.product_id ?? ""),
      name: text(item.product_name_snapshot) || product?.name || "Product",
      itemCode: text(item.item_code_snapshot) || text(product?.item_code),
      ean: text(item.ean_snapshot) || text(product?.ean) || text(product?.barcode),
      supplierCode: text(item.supplier_code_snapshot) || text(product?.supplier_code) || text(product?.supplier_product_code),
      quantity,
    };
  }).filter((line) => line.quantity > 0);
  const totals = summarize(lines);
  if (!row.id || !row.store_id || !row.supplier_id) return null;
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    supplierId: String(row.supplier_id),
    storeName: store?.name || "Store",
    storeCode: text(store?.code),
    storeEmail: text(store?.email),
    supplierName: supplier?.name || "Supplier",
    supplierEmail: text(supplier?.order_email),
    supplierCc: emailList(supplier?.cc_emails),
    orderDate: String(row.order_date ?? ""),
    deliveryDate: text(row.delivery_date),
    status: String(row.status ?? "draft"),
    emailStatus: text(row.email_status),
    submittedAt: text(row.submitted_at),
    createdAt: text(row.created_at),
    lines,
    products: totals.products,
    totalQty: totals.quantity,
  };
}

function toListItem(order: OrderDetail): OrderListItem {
  return {
    id: order.id,
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate,
    status: order.status,
    emailStatus: order.emailStatus,
    submittedAt: order.submittedAt,
    storeId: order.storeId,
    storeName: order.storeName,
    storeCode: order.storeCode,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    products: order.products,
    totalQty: order.totalQty,
  };
}

async function selectOrders(filters: { 
  storeId?: string; 
  supplierId?: string; 
  date?: string; 
  dateFrom?: string; 
  dateTo?: string; 
  deliveryDate?: string; 
  status?: string; 
  emailStatus?: string; 
  limit?: number 
}) {
  const run = (columns: string, includeDelivery: boolean) => {
    let query = db().from("orders").select(columns).order("order_date", { ascending: false }).limit(filters.limit ?? 200);
    if (filters.storeId) query = query.eq("store_id", filters.storeId);
    if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
    if (filters.date) query = query.eq("order_date", filters.date);
    if (filters.dateFrom) query = query.gte("order_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("order_date", filters.dateTo);
    if (includeDelivery && filters.deliveryDate) query = query.eq("delivery_date", filters.deliveryDate);
    if (filters.status) query = query.eq("status", filters.status);
    if (includeDelivery && filters.emailStatus) query = query.eq("email_status", filters.emailStatus);
    return query;
  };
  const primary = await run(ORDER_SELECT, true);
  if (!primary.error) return primary.data ?? [];
  logServerError("orders", primary.error.message);
  const basic = await run(ORDER_SELECT_BASIC, false);
  if (basic.error) {
    logServerError("orders", basic.error.message);
    return [];
  }
  return basic.data ?? [];
}

export async function listOrders(filters: { 
  storeId?: string; 
  supplierId?: string; 
  date?: string; 
  dateFrom?: string; 
  dateTo?: string; 
  deliveryDate?: string; 
  status?: string; 
  emailStatus?: string; 
  limit?: number 
}) {
  const data = await selectOrders(filters);
  return data
    .map((row) => mapOrder(row as unknown as Record<string, unknown>))
    .filter((order): order is OrderDetail => Boolean(order))
    .map(toListItem)
    .sort((a, b) => (b.submittedAt || b.orderDate).localeCompare(a.submittedAt || a.orderDate));
}

export async function getOrder(id: string) {
  const primary = await db().from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  const chosen = primary.error ? await db().from("orders").select(ORDER_SELECT_BASIC).eq("id", id).maybeSingle() : primary;
  if (chosen.error || !chosen.data) {
    if (chosen.error) logServerError("order", chosen.error.message);
    return null;
  }
  return mapOrder(chosen.data as Record<string, unknown>);
}

export async function getOrCreateDraft(input: { storeId: string; supplierId: string; userId: string; deliveryDate: string }) {
  const orderDate = londonToday();
  const existing = await db()
    .from("orders")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("supplier_id", input.supplierId)
    .eq("delivery_date", input.deliveryDate)
    .eq("status", "draft")
    .limit(1);
  const existingId = existing.data?.[0]?.id;
  if (existingId) return { id: String(existingId), orderDate, deliveryDate: input.deliveryDate };

  const inserted = await insertDraft({
    store_id: input.storeId,
    supplier_id: input.supplierId,
    order_date: orderDate,
    delivery_date: input.deliveryDate,
    status: "draft",
    email_status: "pending",
    created_by: input.userId,
  });
  if (inserted) return { id: inserted, orderDate, deliveryDate: input.deliveryDate };
  const again = await db()
    .from("orders")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("supplier_id", input.supplierId)
    .eq("order_date", orderDate)
    .eq("status", "draft")
    .limit(1);
  const reused = again.data?.[0]?.id;
  if (!reused) return null;
  await db().from("orders").update({ delivery_date: input.deliveryDate }).eq("id", reused).eq("status", "draft");
  return { id: String(reused), orderDate, deliveryDate: input.deliveryDate };
}

async function insertDraft(payload: Record<string, unknown>) {
  const current = { ...payload };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await db().from("orders").insert(current).select("id").maybeSingle();
    if (!error && data?.id) return String(data.id);
    if (!error) return null;
    const column = /Could not find the '([^']+)' column/.exec(error.message)?.[1] || /column "([^"]+)"/.exec(error.message)?.[1];
    if (column && column in current && column !== "store_id" && column !== "supplier_id" && column !== "status") {
      delete current[column];
      continue;
    }
    if (/created_by/i.test(error.message) && "created_by" in current) {
      delete current.created_by;
      continue;
    }
    logServerError("draft", error.message);
    return null;
  }
  return null;
}

export async function listStores() {
  const primary = await db().from("stores").select("id, name, code, email, active").order("name");
  const source = primary.error
    ? await db().from("stores").select("id, name, code, active").order("name")
    : primary;
  if (source.error) return [] as StoreRow[];
  return (source.data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id),
      name: String(record.name),
      code: text(record.code),
      email: text(record.email),
      active: record.active !== false,
    };
  });
}

export async function listUsers() {
  const primary = await db()
    .from("profiles")
    .select("user_id, full_name, role, store_id, active, pin_enabled, last_seen_at, stores(name, code)")
    .order("full_name");
  const rows = primary.error ? null : primary.data;
  const source = rows ?? (await db().from("profiles").select("user_id, full_name, role, store_id, active, stores(name, code)").order("full_name")).data;
  return (source ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const store = one(record.stores as Embedded<{ name?: string; code?: string | null }>);
    return {
      userId: String(record.user_id),
      fullName: String(record.full_name ?? ""),
      role: String(record.role ?? ""),
      storeId: text(record.store_id),
      storeName: store?.name ?? null,
      storeCode: text(store?.code),
      active: record.active !== false,
      pinEnabled: record.pin_enabled !== false,
      lastSeenAt: text(record.last_seen_at),
    } satisfies UserRow;
  });
}

export async function listAssignments() {
  const { data, error } = await db().from("store_suppliers").select("id, store_id, supplier_id, active, order_deadline");
  if (error) {
    if (!isMissingRelation(error)) logServerError("assignments", error.message);
    return [] as AssignmentRow[];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    storeId: String(row.store_id),
    supplierId: String(row.supplier_id),
    active: row.active !== false,
    orderDeadline: row.order_deadline ? String(row.order_deadline).slice(0, 5) : null,
  }));
}

export async function getOrderSettings(): Promise<OrderSettings> {
  const { data, error } = await db().from("app_settings").select("value").eq("key", "orders").maybeSingle();
  if (error || !data?.value || typeof data.value !== "object") return { deadline: "", enforce: false, note: "" };
  const value = data.value as Record<string, unknown>;
  return {
    deadline: typeof value.deadline === "string" ? value.deadline : "",
    enforce: value.enforce === true,
    note: typeof value.note === "string" ? value.note : "",
  };
}

export async function assignmentDeadline(storeId: string, supplierId: string) {
  const { data, error } = await db()
    .from("store_suppliers")
    .select("order_deadline")
    .eq("store_id", storeId)
    .eq("supplier_id", supplierId)
    .eq("active", true)
    .maybeSingle();
  if (error || !data?.order_deadline) return null;
  return String(data.order_deadline).slice(0, 5);
}

export async function listAudit() {
  const { data, error } = await db()
    .from("audit_log")
    .select("id, actor_name, actor_role, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    if (!isMissingRelation(error)) logServerError("audit list", error.message);
    return [] as AuditRow[];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    actorName: text(row.actor_name),
    actorRole: text(row.actor_role),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: text(row.entity_id),
    createdAt: String(row.created_at),
    metadata: (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>,
  }));
}

export type MissingOrderRow = {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  supplierId: string;
  supplierName: string;
  deadline: string | null;
};

export type ConsolidationOrderLine = {
  productId: string;
  productName: string;
  itemCode: string | null;
  barcode: string | null;
  caseSize: number;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  quantity: number;
};

export async function getConsolidationData(params: {
  supplierId: string;
  orderDate?: string;
  deliveryDate?: string;
}): Promise<ConsolidationOrderLine[]> {
  let query = db()
    .from("orders")
    .select(`
      store_id,
      stores!inner(name, code),
      order_items!inner(
        products!inner(id, name, item_code, barcode, case_size),
        quantity
      )
    `)
    .eq("supplier_id", params.supplierId)
    .neq("status", "cancelled");

  if (params.orderDate) {
    query = query.eq("order_date", params.orderDate);
  }
  if (params.deliveryDate) {
    query = query.eq("delivery_date", params.deliveryDate);
  }

  const { data, error } = await query;

  if (error) {
    logServerError("consolidation data", error.message);
    return [];
  }

  const lines: ConsolidationOrderLine[] = [];
  
  for (const order of data ?? []) {
    const storeData = Array.isArray(order.stores) ? order.stores[0] : order.stores;
    if (!storeData || !Array.isArray(order.order_items)) continue;

    for (const item of order.order_items) {
      const productData = Array.isArray(item.products) ? item.products[0] : item.products;
      if (!productData || !item.quantity) continue;

      lines.push({
        productId: String(productData.id),
        productName: String(productData.name),
        itemCode: text(productData.item_code),
        barcode: text(productData.barcode),
        caseSize: Number(productData.case_size) || 1,
        storeId: String(order.store_id),
        storeName: String(storeData.name),
        storeCode: text(storeData.code),
        quantity: Number(item.quantity),
      });
    }
  }

  return lines;
}

export type OrderStats = {
  totalOrders: number;
  draftOrders: number;
  submittedOrders: number;
  cancelledOrders: number;
  totalProducts: number;
  totalQuantity: number;
  storeCount: number;
  supplierCount: number;
};

export async function getOrderStats(params: {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  supplierId?: string;
}): Promise<OrderStats> {
  let ordersQuery = db()
    .from("orders")
    .select("id, status, store_id, supplier_id", { count: "exact" });

  let itemsQuery = db()
    .from("orders")
    .select(`
      order_items!inner(quantity, product_id)
    `);

  if (params.startDate) {
    ordersQuery = ordersQuery.gte("order_date", params.startDate);
    itemsQuery = itemsQuery.gte("order_date", params.startDate);
  }
  if (params.endDate) {
    ordersQuery = ordersQuery.lte("order_date", params.endDate);
    itemsQuery = itemsQuery.lte("order_date", params.endDate);
  }
  if (params.storeId) {
    ordersQuery = ordersQuery.eq("store_id", params.storeId);
    itemsQuery = itemsQuery.eq("store_id", params.storeId);
  }
  if (params.supplierId) {
    ordersQuery = ordersQuery.eq("supplier_id", params.supplierId);
    itemsQuery = itemsQuery.eq("supplier_id", params.supplierId);
  }

  const [ordersResult, itemsResult] = await Promise.all([
    ordersQuery,
    itemsQuery,
  ]);

  const orders = ordersResult.data ?? [];
  const draftOrders = orders.filter((o) => o.status === "draft").length;
  const submittedOrders = orders.filter((o) => o.status === "submitted").length;
  const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;
  const storeIds = new Set(orders.map((o) => o.store_id));
  const supplierIds = new Set(orders.map((o) => o.supplier_id));

  let totalProducts = 0;
  let totalQuantity = 0;
  const productIds = new Set<string>();

  for (const order of itemsResult.data ?? []) {
    if (!Array.isArray(order.order_items)) continue;
    for (const item of order.order_items) {
      if (item.product_id) productIds.add(String(item.product_id));
      totalQuantity += Number(item.quantity) || 0;
    }
  }

  totalProducts = productIds.size;

  return {
    totalOrders: orders.length,
    draftOrders,
    submittedOrders,
    cancelledOrders,
    totalProducts,
    totalQuantity,
    storeCount: storeIds.size,
    supplierCount: supplierIds.size,
  };
}

export type ProductOrderSummary = {
  productId: string;
  productName: string;
  itemCode: string | null;
  ean: string | null;
  supplierName: string;
  caseSize: number;
  totalOrders: number;
  totalQuantity: number;
  lastOrderDate: string | null;
};

export async function getProductOrderSummary(params: {
  startDate?: string;
  endDate?: string;
  supplierId?: string;
}): Promise<ProductOrderSummary[]> {
  let query = db()
    .from("products")
    .select(`
      id,
      name,
      item_code,
      barcode,
      case_size,
      supplier_id,
      suppliers!inner(name),
      order_items!left(
        quantity,
        orders!inner(order_date, status)
      )
    `)
    .eq("active", true);

  if (params.supplierId) {
    query = query.eq("supplier_id", params.supplierId);
  }

  const { data, error } = await query;

  if (error) {
    logServerError("product order summary", error.message);
    return [];
  }

  const results: ProductOrderSummary[] = [];

  for (const product of data ?? []) {
    const supplierData = Array.isArray(product.suppliers)
      ? product.suppliers[0]
      : product.suppliers;
    const orderItems = Array.isArray(product.order_items)
      ? product.order_items
      : [];

    let totalQuantity = 0;
    let orderCount = 0;
    let lastOrderDate: string | null = null;
    const orderDates: string[] = [];

    for (const item of orderItems) {
      const orderData = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      if (!orderData || orderData.status === "cancelled") continue;

      const orderDate = String(orderData.order_date);
      
      if (params.startDate && orderDate < params.startDate) continue;
      if (params.endDate && orderDate > params.endDate) continue;

      totalQuantity += Number(item.quantity) || 0;
      orderCount++;
      orderDates.push(orderDate);
    }

    if (orderDates.length > 0) {
      orderDates.sort();
      lastOrderDate = orderDates[orderDates.length - 1];
    }

    if (orderCount > 0 || !params.startDate) {
      results.push({
        productId: String(product.id),
        productName: String(product.name),
        itemCode: text(product.item_code),
        ean: text(product.barcode),
        supplierName: supplierData ? String(supplierData.name) : "",
        caseSize: Number(product.case_size) || 1,
        totalOrders: orderCount,
        totalQuantity,
        lastOrderDate,
      });
    }
  }

  return results.sort((a, b) => {
    if (a.totalQuantity !== b.totalQuantity) {
      return b.totalQuantity - a.totalQuantity;
    }
    return a.productName.localeCompare(b.productName);
  });
}

export async function listMissingOrders(targetDate: string): Promise<MissingOrderRow[]> {
  const [assignments, stores, suppliers, orders] = await Promise.all([
    listAssignments(),
    listStores(),
    listSuppliers(),
    db()
      .from("orders")
      .select("store_id, supplier_id, order_date, status")
      .eq("order_date", targetDate)
      .neq("status", "cancelled"),
  ]);

  const activeAssignments = assignments.filter((a) => a.active);
  const storeMap = new Map(stores.map((s) => [s.id, s]));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const orderSet = new Set(
    (orders.data ?? []).map((o) => `${o.store_id}|${o.supplier_id}`)
  );

  const missing: MissingOrderRow[] = [];

  for (const assignment of activeAssignments) {
    const key = `${assignment.storeId}|${assignment.supplierId}`;
    const store = storeMap.get(assignment.storeId);
    const supplier = supplierMap.get(assignment.supplierId);

    if (store && supplier && store.active && supplier.active && !orderSet.has(key)) {
      missing.push({
        storeId: assignment.storeId,
        storeName: store.name,
        storeCode: store.code,
        supplierId: assignment.supplierId,
        supplierName: supplier.name,
        deadline: assignment.orderDeadline,
      });
    }
  }

  return missing.sort((a, b) => {
    const nameCompare = a.storeName.localeCompare(b.storeName);
    if (nameCompare !== 0) return nameCompare;
    return a.supplierName.localeCompare(b.supplierName);
  });
}
