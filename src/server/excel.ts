import "server-only";
import ExcelJS from "exceljs";
import { consolidate, storeColumnLabel } from "@/lib/consolidation";
import { formatUkDate } from "@/lib/format";
import type { ConsolidationOrderLine, OrderDetail } from "./queries";

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

export async function consolidationWorkbook(
  supplierName: string,
  lines: ConsolidationOrderLine[],
  orderDate?: string,
  deliveryDate?: string
) {
  const casesData = lines.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    itemCode: line.itemCode,
    barcode: line.barcode,
    caseSize: line.caseSize,
    storeId: line.storeId,
    storeName: line.storeName,
    storeCode: line.storeCode,
    cases: line.quantity,
  }));

  const result = consolidate(casesData);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Consolidation");

  sheet.addRow(["Supplier", supplierName]);
  if (orderDate) sheet.addRow(["Order date", formatUkDate(orderDate)]);
  if (deliveryDate) sheet.addRow(["Delivery date", formatUkDate(deliveryDate)]);
  sheet.addRow([]);

  const headerRow = [
    "Product",
    "Item Code",
    "Barcode",
    "Case Size",
    ...result.stores.map(storeColumnLabel),
    "Total Cases",
    "Total Units",
  ];
  sheet.addRow(headerRow);

  for (const row of result.rows) {
    sheet.addRow([
      row.productName,
      row.itemCode || "",
      row.barcode || "",
      row.caseSize,
      ...result.stores.map((store) => row.byStore[store.id] || 0),
      row.totalCases,
      row.totalUnits,
    ]);
  }

  const headerRowIndex = sheet.lastRow!.number - result.rows.length;
  sheet.getRow(headerRowIndex).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const datePart = deliveryDate || orderDate || formatUkDate(new Date().toISOString());
  const filename = `consolidation-${safeName(supplierName)}-${datePart}.xlsx`;
  return download(buffer, filename);
}
