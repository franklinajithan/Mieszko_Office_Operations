import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderEditor } from "@/components/order-editor";
import { formatUkDate, storeLabel } from "@/lib/format";
import { getOrder, getSupplier, listSupplierProducts } from "@/server/queries";
import { requireStore } from "@/server/session";

export default async function ShopOrderPage({ params }: { params: Promise<{ supplierId: string }> }) {
  const staff = await requireStore();
  const { supplierId: orderId } = await params;
  const order = await getOrder(orderId);
  if (!order || order.storeId !== staff.storeId) notFound();
  if (order.status !== "draft") redirect(`/shop/orders/${order.id}`);
  const supplier = await getSupplier(order.supplierId);
  if (!supplier?.active) {
    return (
      <>
        <p><Link href="/shop/new">Choose another supplier</Link></p>
        <div className="emptyState"><h2>Supplier unavailable</h2><p>This supplier is no longer active.</p></div>
      </>
    );
  }
  const products = await listSupplierProducts(order.supplierId);
  const quantities = new Map(order.lines.map((line) => [line.productId, line.quantity]));
  return (
    <>
      <p><Link href="/shop/new">Change supplier or date</Link></p>
      <h1>{supplier.name}</h1>
      <p className="muted">{storeLabel(staff.storeName, staff.storeCode)} · Delivery {formatUkDate(order.deliveryDate)}</p>
      <OrderEditor
        orderId={order.id}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          polishName: product.polishName,
          itemCode: product.itemCode,
          ean: product.ean,
          supplierCode: product.supplierCode,
          quantity: quantities.get(product.id) || 0,
        }))}
      />
    </>
  );
}
