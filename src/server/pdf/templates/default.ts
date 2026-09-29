import PDFDocument from "pdfkit";
import type { OrderPdfModel } from "../model";
import { pdfFonts } from "../fonts";

type PdfDoc = InstanceType<typeof PDFDocument>;

const INK = "#17201c";
const MUTED = "#59635e";
const LINE = "#e2e6e3";
const HEADER = "#17201c";
const BRAND = "#b91f26";
const COLS = [
  { key: "itemCode", title: "Item Code", width: 68, align: "left" as const },
  { key: "ean", title: "EAN", width: 108, align: "left" as const },
  { key: "supplierCode", title: "Supplier Code", width: 78, align: "left" as const },
  { key: "name", title: "Product Name", width: 217, align: "left" as const },
  { key: "quantity", title: "Qty", width: 40, align: "right" as const },
];

export function renderDefaultOrderPdf(model: OrderPdfModel) {
  const fonts = pdfFonts();
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 46, bottom: 58, left: 42, right: 42 },
      bufferPages: true,
      info: {
        Title: `Mieszko order ${model.orderNumber}`,
        Author: "Mieszko Office Operations",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("Body", fonts.regular);
    doc.registerFont("Bold", fonts.bold);

    let y = drawCover(doc, model);
    y = drawTableHeader(doc, y);
    for (const line of model.lines) {
      const height = rowHeight(doc, line);
      if (y + height > pageLimit(doc)) {
        doc.addPage();
        y = drawTableHeader(doc, doc.page.margins.top);
      }
      y = drawRow(doc, line, y, height);
    }
    y = drawTotals(doc, model, y);
    drawFooters(doc);
    doc.end();
  });
}

function contentWidth() {
  return COLS.reduce((sum, column) => sum + column.width, 0);
}

function pageLimit(doc: PdfDoc) {
  return doc.page.height - doc.page.margins.bottom;
}

function drawCover(doc: PdfDoc, model: OrderPdfModel) {
  const left = doc.page.margins.left;
  const width = contentWidth();
  doc.rect(left, 32, width, 4).fill(BRAND);
  doc.fillColor(BRAND).font("Bold").fontSize(20).text("MIESZKO", left, 46, { width: 280, lineBreak: false });
  doc.fillColor(MUTED).font("Bold").fontSize(9).text("OFFICE OPERATIONS", left, 70, { characterSpacing: 1.1, lineBreak: false });
  doc.roundedRect(left + width - 118, 48, 118, 26, 3).lineWidth(1).strokeColor(BRAND).stroke();
  doc.fillColor(BRAND).font("Bold").fontSize(11).text("ORDER COPY", left + width - 118, 55, { width: 118, align: "center", lineBreak: false });

  const facts: [string, string][] = [
    ["Shop", model.storeName],
    ["Store Code", model.storeCode || "—"],
    ["Supplier", model.supplierName],
    ["Delivery Date", model.deliveryDate],
    ["Order Date", model.orderDate],
    ["Order Number", model.orderNumber],
  ];
  let y = 98;
  const columnWidth = width / 2 - 8;
  facts.forEach((fact, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = left + column * (columnWidth + 16);
    const top = y + row * 28;
    doc.fillColor(MUTED).font("Bold").fontSize(8).text(fact[0].toUpperCase(), x, top, { width: columnWidth, lineBreak: false });
    doc.fillColor(INK).font("Body").fontSize(10).text(fact[1], x, top + 11, { width: columnWidth });
  });
  y += 3 * 28 + 8;
  doc.moveTo(left, y).lineTo(left + width, y).strokeColor(LINE).lineWidth(1).stroke();
  return y + 12;
}

function drawTableHeader(doc: PdfDoc, y: number) {
  const left = doc.page.margins.left;
  const width = contentWidth();
  doc.rect(left, y, width, 20).fill(HEADER);
  let x = left;
  doc.fillColor("#ffffff").font("Bold").fontSize(8);
  for (const column of COLS) {
    doc.text(column.title.toUpperCase(), x + 4, y + 6, { width: column.width - 8, align: column.align, lineBreak: false });
    x += column.width;
  }
  return y + 20;
}

function rowHeight(doc: PdfDoc, line: OrderPdfModel["lines"][number]) {
  const nameWidth = COLS[3].width - 8;
  doc.font("Bold").fontSize(9);
  let height = doc.heightOfString(line.name, { width: nameWidth }) + 8;
  if (line.polishName) {
    doc.font("Body").fontSize(8);
    height += doc.heightOfString(line.polishName, { width: nameWidth }) + 1;
  }
  return Math.max(22, height);
}

function drawRow(doc: PdfDoc, line: OrderPdfModel["lines"][number], y: number, height: number) {
  const left = doc.page.margins.left;
  const values = [line.itemCode, line.ean, line.supplierCode, line.name, String(line.quantity)];
  let x = left;
  doc.fillColor(INK).font("Body").fontSize(9);
  values.forEach((value, index) => {
    const column = COLS[index];
    if (index === 3) {
      doc.font("Bold").fontSize(9).fillColor(INK).text(line.name, x + 4, y + 4, { width: column.width - 8 });
      if (line.polishName) {
        doc.font("Body").fontSize(8).fillColor(MUTED).text(line.polishName, x + 4, doc.y, { width: column.width - 8 });
      }
    } else {
      doc.font("Body").fontSize(9).fillColor(INK).text(value, x + 4, y + 6, {
        width: column.width - 8,
        align: column.align,
        lineBreak: false,
      });
    }
    x += column.width;
  });
  doc.moveTo(left, y + height).lineTo(left + contentWidth(), y + height).strokeColor(LINE).lineWidth(0.6).stroke();
  return y + height;
}

function drawTotals(doc: PdfDoc, model: OrderPdfModel, y: number) {
  if (y + 48 > pageLimit(doc)) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  const left = doc.page.margins.left;
  y += 14;
  doc.fillColor(INK).font("Bold").fontSize(11).text(`Total Products: ${model.totalProducts}`, left, y, { lineBreak: false });
  doc.text(`Total Qty: ${model.totalQty}`, left + 180, y, { lineBreak: false });
  return y + 20;
}

function drawFooters(doc: PdfDoc) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 34;
    doc.font("Body").fontSize(8).fillColor(MUTED).text("Generated by Mieszko Office Operations", doc.page.margins.left, y, {
      width: contentWidth() - 50,
      height: 12,
      lineBreak: false,
    });
    doc.text(`${index + 1} / ${range.count}`, doc.page.margins.left, y, {
      width: contentWidth(),
      align: "right",
      height: 12,
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }
}
