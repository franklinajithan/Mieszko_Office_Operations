import { NextResponse } from "next/server";
import { consolidationWorkbook } from "@/server/excel";
import { getConsolidationData, listSuppliers } from "@/server/queries";
import { requireOffice } from "@/server/session";

export async function GET(request: Request) {
  try {
    await requireOffice();
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplier");
    const orderDate = searchParams.get("date") || undefined;
    const deliveryDate = searchParams.get("delivery") || undefined;

    if (!supplierId) {
      return NextResponse.json({ error: "Supplier required" }, { status: 400 });
    }

    const [suppliers, lines] = await Promise.all([
      listSuppliers(),
      getConsolidationData({ supplierId, orderDate, deliveryDate }),
    ]);

    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return await consolidationWorkbook(supplier.name, lines, orderDate, deliveryDate);
  } catch (error) {
    console.error("Consolidation export error:", error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
