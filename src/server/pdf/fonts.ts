import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: { regular: Buffer; bold: Buffer } | null = null;

export function pdfFonts() {
  if (!cached) {
    cached = {
      regular: readFileSync(join(process.cwd(), "src/server/pdf/fonts/Roboto-Regular.ttf")),
      bold: readFileSync(join(process.cwd(), "src/server/pdf/fonts/Roboto-Bold.ttf")),
    };
  }
  return cached;
}
