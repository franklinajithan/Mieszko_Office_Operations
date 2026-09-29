import "server-only";
import ExcelJS from "exceljs";
import { formatUkDate } from "@/lib/format";
import type { OrderDetail } from "./queries";

function download(buffer: ExcelJS.Buffer, filename: string) {
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function safeName(value: string) {
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "order";
}

export async function storeOrderWorkbook(order: OrderDetail) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Order");
  sheet.addRow(["Shop", order.storeName]);
  sheet.addRow(["Store code", order.storeCode || ""]);
  sheet.addRow(["Supplier", order.supplierName]);
  sheet.addRow(["Order date", formatUkDate(order.orderDate)]);
  sheet.addRow(["Delivery date", formatUkDate(order.deliveryDate)]);
  sheet.addRow([]);
  sheet.addRow(["Item Code", "EAN", "Supplier Code", "Product Name", "Qty"]);
  for (const line of order.lines) {
    sheet.addRow([line.itemCode || "", line.ean || "", line.supplierCode || "", line.name, line.quantity]);
  }
  sheet.getRow(7).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 22; });
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${safeName(order.storeName)}-${safeName(order.supplierName)}-${order.deliveryDate || order.orderDate}.xlsx`;
  return download(buffer, filename);
}
